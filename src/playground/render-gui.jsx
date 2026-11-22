import React from 'react';
import GUI from '../containers/gui.jsx';

const searchParams = new URLSearchParams(location.search);
const cloudHost = searchParams.get('cloud_host') || 'wss://clouddata.turbowarp.org';

const RenderGUI = props => (
    <GUI
        cloudHost={cloudHost}
        canUseCloud={false}
        hasCloudPermission={false}
        canChangeLanguage={false}
        canSave={false}
        basePath={process.env.ROOT}
        canEditTitle={false}
        enableCommunity={false}
        {...props}
    />
);

export default RenderGUI;
