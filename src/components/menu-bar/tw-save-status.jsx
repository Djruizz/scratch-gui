import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React from 'react';
import InlineMessages from '../../containers/inline-messages.jsx';
import {filterInlineAlerts} from '../../reducers/alerts';

const TWSaveStatus = ({
    alertsList
}) => (
    filterInlineAlerts(alertsList).length > 0 ? (
        <InlineMessages />
    ) : null
);

TWSaveStatus.propTypes = {
    alertsList: PropTypes.arrayOf(PropTypes.object)
};

const mapStateToProps = state => ({
    alertsList: state.scratchGui.alerts.alertsList
});

export default connect(
    mapStateToProps,
    () => ({})
)(TWSaveStatus);
