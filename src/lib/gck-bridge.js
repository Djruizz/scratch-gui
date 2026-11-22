import {costumeUpload, spriteUpload} from './file-uploader';

const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
const PROJECT_CHANGED_DEBOUNCE_MS = 1000;
const SNAPSHOT_TIMEOUT_MS = 5000;

let activeVm = null;
let verifiedParentOrigin = null;
let bridgeInitialized = false;
let projectChangedTimer = null;
const subscribedVms = new WeakSet();

const getAllowedOrigins = () => {
    const raw = process.env.GCK_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS;
    const origins = new Set(
        raw
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
    );
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        origins.add(window.location.origin);
    }
    return origins;
};

const isAllowedOrigin = origin => {
    if (!origin || origin === 'null') {
        return false;
    }
    return getAllowedOrigins().has(origin);
};

const postToParent = (message, transfer = []) => {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) {
        return;
    }

    if (verifiedParentOrigin) {
        window.parent.postMessage(message, verifiedParentOrigin, transfer);
        return;
    }

    const origins = getAllowedOrigins();
    origins.forEach(origin => {
        if (origin !== window.location.origin) {
            try {
                window.parent.postMessage(message, origin, transfer);
            } catch (e) {
                // Ignore origins that do not match the actual embedding parent.
            }
        }
    });
};

const base64ToUint8Array = rawBase64 => {
    const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const mimeFromDataFormat = format => {
    const normalized = String(format || 'png').toLowerCase();
    if (normalized === 'svg') return 'image/svg+xml';
    if (normalized === 'webp') return 'image/webp';
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    return 'image/png';
};

const captureStagePng = vm => new Promise((resolve, reject) => {
    if (!vm || !vm.renderer || typeof vm.renderer.requestSnapshot !== 'function') {
        reject(new Error('El renderizador de Scratch no está disponible.'));
        return;
    }

    let settled = false;
    const timer = setTimeout(() => {
        if (!settled) {
            settled = true;
            reject(new Error('Tiempo de espera agotado al capturar el escenario.'));
        }
    }, SNAPSHOT_TIMEOUT_MS);

    vm.renderer.requestSnapshot(dataUrl => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(dataUrl);
    });

    if (typeof vm.renderer.draw === 'function') {
        vm.renderer.draw();
    }
});

const addCostumeFromPayload = (vm, payload) => new Promise((resolve, reject) => {
    if (!payload || typeof payload.dataBase64 !== 'string') {
        reject(new Error('Los datos del disfraz son obligatorios.'));
        return;
    }

    const bytes = base64ToUint8Array(payload.dataBase64);
    const mimeType = mimeFromDataFormat(payload.dataFormat);
    const costumeName = typeof payload.name === 'string' && payload.name.trim() ?
        payload.name.trim() :
        'Disfraz';

    costumeUpload(
        bytes.buffer,
        mimeType,
        vm,
        async vmCostumes => {
            try {
                for (const costume of vmCostumes) {
                    costume.name = costumeName;
                    await vm.addCostume(costume.md5, costume);
                }
                resolve({added: true, count: vmCostumes.length});
            } catch (err) {
                reject(err);
            }
        },
        err => reject(new Error(typeof err === 'string' ? err : 'No fue posible agregar el disfraz.'))
    );
});

const addSpriteFromPayload = (vm, payload) => new Promise((resolve, reject) => {
    if (!payload || typeof payload.dataBase64 !== 'string') {
        reject(new Error('Los datos del personaje son obligatorios.'));
        return;
    }

    const bytes = base64ToUint8Array(payload.dataBase64);
    const mimeType = mimeFromDataFormat(payload.dataFormat);
    const spriteName = typeof payload.name === 'string' && payload.name.trim() ?
        payload.name.trim() :
        'Personaje';

    spriteUpload(
        bytes.buffer,
        mimeType,
        spriteName,
        vm,
        async spriteData => {
            try {
                await vm.addSprite(spriteData);
                resolve({added: true});
            } catch (err) {
                reject(err);
            }
        },
        err => reject(new Error(typeof err === 'string' ? err : 'No fue posible agregar el personaje.'))
    );
});

const handleBridgeCommand = async (type, payload) => {
    if (!activeVm) {
        throw new Error('La máquina virtual de Scratch aún no está inicializada.');
    }

    switch (type) {
    case 'GCK_PING':
        return {
            ready: Boolean(activeVm.initialized),
            locale: 'es-419'
        };
    case 'GCK_LOAD_PROJECT': {
        if (!payload || !payload.buffer) {
            throw new Error('Se requiere el buffer del archivo .sb3.');
        }
        await activeVm.loadProject(payload.buffer);
        if (activeVm.renderer && typeof activeVm.renderer.draw === 'function') {
            activeVm.renderer.draw();
        }
        return {loaded: true};
    }
    case 'GCK_EXPORT_SB3': {
        const buffer = await activeVm.saveProjectSb3('arraybuffer');
        return {
            data: {buffer},
            transfer: [buffer]
        };
    }
    case 'GCK_GET_PROJECT_JSON':
        return {json: activeVm.toJSON()};
    case 'GCK_CAPTURE_STAGE': {
        const dataUrl = await captureStagePng(activeVm);
        return {dataUrl};
    }
    case 'GCK_ADD_COSTUME':
        return addCostumeFromPayload(activeVm, payload);
    case 'GCK_ADD_SPRITE':
        return addSpriteFromPayload(activeVm, payload);
    case 'GCK_GREEN_FLAG':
        activeVm.start();
        activeVm.greenFlag();
        return {started: true};
    case 'GCK_STOP_ALL':
        activeVm.stopAll();
        return {stopped: true};
    case 'GCK_KEY_INPUT': {
        if (!payload || typeof payload.key !== 'string') {
            throw new Error('Se requiere la tecla para simular entrada táctil.');
        }
        activeVm.postIOData('keyboard', {
            key: payload.key,
            isDown: Boolean(payload.isDown)
        });
        return {ok: true};
    }
    default:
        throw new Error(`Comando de puente no soportado: ${type}`);
    }
};

const handleWindowMessage = async event => {
    if (typeof window === 'undefined' || event.source !== window.parent) {
        return;
    }
    if (!isAllowedOrigin(event.origin)) {
        return;
    }

    const message = event.data;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return;
    }
    if (!message.type.startsWith('GCK_')) {
        return;
    }
    if (
        message.type === 'GCK_RESPONSE' ||
        message.type === 'GCK_EDITOR_READY' ||
        message.type === 'GCK_PROJECT_CHANGED'
    ) {
        return;
    }

    verifiedParentOrigin = event.origin;
    const {requestId, type, payload} = message;

    try {
        const result = await handleBridgeCommand(type, payload);
        if (requestId) {
            if (result && Array.isArray(result.transfer)) {
                postToParent({
                    type: 'GCK_RESPONSE',
                    requestId,
                    ok: true,
                    data: result.data
                }, result.transfer);
            } else {
                postToParent({
                    type: 'GCK_RESPONSE',
                    requestId,
                    ok: true,
                    data: result
                });
            }
        }
    } catch (error) {
        if (requestId) {
            postToParent({
                type: 'GCK_RESPONSE',
                requestId,
                ok: false,
                error: error && error.message ? error.message : 'Error inesperado en el editor.'
            });
        }
    }
};

const attachVmListeners = vm => {
    if (!vm || subscribedVms.has(vm)) {
        return;
    }
    subscribedVms.add(vm);

    vm.on('PROJECT_CHANGED', () => {
        if (projectChangedTimer) {
            clearTimeout(projectChangedTimer);
        }
        projectChangedTimer = setTimeout(() => {
            postToParent({
                type: 'GCK_PROJECT_CHANGED',
                timestamp: Date.now()
            });
        }, PROJECT_CHANGED_DEBOUNCE_MS);
    });
};

/**
 * Registers the GameCodeKids postMessage bridge against the active Scratch VM instance.
 * Safe to invoke multiple times across renders/HMR.
 * @param {object} vm Scratch Virtual Machine instance
 */
export const initGckBridge = vm => {
    activeVm = vm;
    attachVmListeners(vm);

    if (typeof window !== 'undefined' && !bridgeInitialized) {
        bridgeInitialized = true;
        window.addEventListener('message', handleWindowMessage);
    }

    postToParent({
        type: 'GCK_EDITOR_READY',
        locale: 'es-419',
        timestamp: Date.now()
    });
};
