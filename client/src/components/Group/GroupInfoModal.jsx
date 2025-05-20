// client/src/components/Group/GroupInfoModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { promoteToAdminAPI, demoteAdminAPI, removeUserFromGroupAPI } from '../../services/api';
import AddMembersModal from './AddMembersModal';
import ConfirmationModal from '../Common/ConfirmationModal';
import './GroupInfoModal.css';

const GroupInfoModal = ({ chat, onClose, onGroupUpdated }) => {
    const { user: currentUser } = useAuth();
    const [internalChatDetails, setInternalChatDetails] = useState(chat);
    const [actionIsLoading, setActionIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showAddMembersModal, setShowAddMembersModal] = useState(false); // This state controls AddMembersModal

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationData, setConfirmationData] = useState({
        title: '', message: '', confirmText: 'Confirm',
        actionTypeToConfirm: null, userIdToConfirm: null,
    });
    
    // General rendering log - can be removed once stable
    // console.log(`[GroupInfoModal] Render. AddMembers: ${showAddMembersModal}, Confirm: ${showConfirmation}, Loading: ${actionIsLoading}`);

    useEffect(() => {
        setInternalChatDetails(chat);
        if (chat?._id !== internalChatDetails?._id) {
            setError('');
            setSuccess('');
        }
    }, [chat, internalChatDetails?._id]);

    const currentChatId = internalChatDetails?._id;
    const currentParticipants = internalChatDetails?.participants;
    const currentGroupAdmins = internalChatDetails?.groupAdmins;
    const currentCreatedBy = internalChatDetails?.createdBy;
    const currentUserId = currentUser?._id;
    const currentUserIsAdmin = internalChatDetails?.groupAdmins?.some(admin => admin._id === currentUserId);

    const executeApiCall = useCallback(async (apiFunc, successMsg, actionTypeForCheck, ...apiParams) => {
        setActionIsLoading(true); setError(''); setSuccess('');
        try {
            const response = await apiFunc(...apiParams);
            console.log(`[GroupInfoModal] API Call Success for ${apiFunc.name}. Response:`, JSON.stringify(response?.data, null, 2));
            if (response?.data) {
                if (response.data.deletedChatId) {
                    setSuccess(successMsg || "Action successful, group deleted.");
                    onGroupUpdated(response.data);
                    onClose();
                } else {
                    onGroupUpdated(response.data);
                    setSuccess(successMsg || "Action successful.");
                    if (actionTypeForCheck === 'remove_member' &&
                        apiParams.length > 1 && apiParams[1] === currentUserId && 
                        !response.data.participants?.some(p => p._id === currentUserId)
                    ) {
                        console.log("[GroupInfoModal] Current user confirmed left the group.");
                    }
                }
            } else { throw new Error("API response empty."); }
        } catch (err) {
            setError(err.response?.data?.message || err.message || `Action failed.`);
            console.error(`[GroupInfoModal] API Call Error for ${apiFunc.name}:`, err.response || err);
        } finally { setActionIsLoading(false); }
    }, [onGroupUpdated, onClose, currentUserId]);

    const handleConfirmedAction = useCallback(async () => {
        setShowConfirmation(false);
        const { actionTypeToConfirm, userIdToConfirm } = confirmationData;
        if (!actionTypeToConfirm || (!userIdToConfirm && actionTypeToConfirm !== 'some_action_not_needing_userId')) {
            setError("Error configuring action."); return;
        }
        if (!currentChatId || !currentUserId) { setError("Missing chat/user ID."); return; }
        console.log(`[GroupInfoModal] CONFIRMED Action: ${actionTypeToConfirm}, Target UserID: ${userIdToConfirm}`);

        switch (actionTypeToConfirm) {
            case 'make_admin': { /* ... as before ... */
                if (!currentUserIsAdmin) { setError("Permission denied."); return; }
                const userToPromote = currentParticipants?.find(p => p._id === userIdToConfirm);
                await executeApiCall(promoteToAdminAPI, `${userToPromote?.name || 'User'} promoted.`, actionTypeToConfirm, currentChatId, userIdToConfirm);
                break;
            }
            case 'remove_admin': { /* ... as before ... */
                if (!currentUserIsAdmin) { setError("Permission denied."); return; }
                const adminToDemote = currentGroupAdmins?.find(a => a._id === userIdToConfirm);
                await executeApiCall(demoteAdminAPI, `${adminToDemote?.name || 'User'} demoted.`, actionTypeToConfirm, currentChatId, userIdToConfirm);
                break;
            }
            case 'remove_member': { /* ... as before ... */
                const isSelfRemoval = userIdToConfirm === currentUserId;
                const memberToRemove = currentParticipants?.find(p => p._id === userIdToConfirm);
                await executeApiCall(removeUserFromGroupAPI, isSelfRemoval ? 'You left.' : `${memberToRemove?.name || 'User'} removed.`, actionTypeToConfirm, currentChatId, userIdToConfirm);
                break;
            }
            default: setError('Invalid confirmed action.');
        }
        setConfirmationData({ title: '', message: '', confirmText: 'Confirm', actionTypeToConfirm: null, userIdToConfirm: null });
    }, [confirmationData, currentChatId, currentUserId, currentUserIsAdmin, currentParticipants, currentGroupAdmins, executeApiCall]);

    const requestConfirmation = useCallback((actionType, userId, title, message, confirmText = "Confirm") => {
        console.log(`[GroupInfoModal] requestConfirmation for Action: ${actionType}, Target UserID: ${userId}`);
        setError(''); setSuccess('');
        setConfirmationData({ title, message, confirmText, actionTypeToConfirm: actionType, userIdToConfirm: userId });
        setShowConfirmation(true);
    }, []);

    const initiateAction = useCallback((actionType, userId) => {
        setError(''); setSuccess('');
        console.log(`[GroupInfoModal] initiateAction: ${actionType}, UserID: ${userId}`);
        let title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm";
        switch (actionType) {
            case 'make_admin': { /* ... as before ... */ 
                if (!currentUserIsAdmin) { setError("Permission denied."); return; }
                const userToPromote = currentParticipants?.find(p => p._id === userId);
                title = "Promote"; message = `Make ${userToPromote?.name || 'user'} an admin?`; confirmText = "Promote";
                break;
            }
            case 'remove_admin': { /* ... as before ... */
                if (!currentUserIsAdmin) { setError("Permission denied."); return; }
                const adminToDemote = currentGroupAdmins?.find(a => a._id === userId);
                if (currentGroupAdmins?.length <= 1 && adminToDemote?._id === currentCreatedBy?._id) {
                    setError("Cannot demote creator if only admin."); return;
                }
                title = "Demote"; message = `Remove ${adminToDemote?.name || 'user'} as admin?`; confirmText = "Demote";
                break;
            }
            case 'remove_member': { /* ... as before ... */
                const isSelfRemoval = userId === currentUserId;
                const memberToRemove = currentParticipants?.find(p => p._id === userId);
                if (isSelfRemoval) {
                    if (memberToRemove?._id === currentCreatedBy?._id && currentParticipants?.length > 1 && currentGroupAdmins?.length === 1 && currentGroupAdmins[0]._id === currentCreatedBy?._id) {
                        setError("Creator & sole admin must act first."); return;
                    }
                    title = "Leave Group"; message = "Leave group?"; confirmText = "Leave";
                } else {
                    if (!currentUserIsAdmin) { setError("Permission denied."); return; }
                    title = "Remove Member"; message = `Remove ${memberToRemove?.name || 'member'}?`; confirmText = "Remove";
                }
                break;
            }
            default: setError('Invalid action.'); return;
        }
        requestConfirmation(actionType, userId, title, message, confirmText);
    }, [currentUserIsAdmin, currentParticipants, currentGroupAdmins, currentCreatedBy, currentUserId, requestConfirmation]);

    const handleMembersAdded = useCallback((updatedChat) => {
        onGroupUpdated(updatedChat);
        setShowAddMembersModal(false);
        setSuccess("Member addition process completed!");
    }, [onGroupUpdated]);

    if (!internalChatDetails?.isGroupChat || !currentUser) {
        return (<div className="modal-backdrop"><div className="modal-content"><p>Loading...</p></div></div>);
    }

    const adminsToRender = Array.isArray(currentGroupAdmins) ? currentGroupAdmins : [];
    const participantsToRender = Array.isArray(currentParticipants) ? currentParticipants : [];

    return (
        <>
            <div className="modal-backdrop group-info-modal-backdrop">
                <div className="modal-content group-info-modal-content">
                    <button onClick={onClose} className="modal-close-btn">×</button>
                    <div className="group-info-header">
                        <h2>{internalChatDetails.name || "Group Chat"}</h2>
                        {currentUserIsAdmin && (
                            <button 
                                onClick={() => { 
                                    console.log("!!!!!!!! [GroupInfoModal] 'Add Members' INLINE onClick EXECUTING !!!!!!!");
                                    setError(''); 
                                    setSuccess(''); 
                                    setShowAddMembersModal(true); // This should trigger AddMembersModal
                                }} 
                                className="action-btn add-members-btn" 
                                disabled={actionIsLoading}
                            >
                                Add Members
                            </button>
                        )}
                    </div>

                    {currentCreatedBy?.name && (
                        <p className="group-creator">
                            Created by: {currentCreatedBy.name}
                            {currentCreatedBy._id === currentUserId && " (You)"}
                        </p>
                    )}
                    <hr />
                    {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}
                    {success && <p className="success-message" style={{ color: 'green' }}>{success}</p>}

                    <h3>Administrators ({adminsToRender.length})</h3>
                    {adminsToRender.length > 0 ? (
                        <ul className="user-list admin-list">
                            {adminsToRender.map(admin => (
                                <li key={admin._id} className="user-list-item admin-item">
                                    <img src={admin.profilePicture || '/default-avatar.png'} alt={admin.name} className="avatar-small" />
                                    <span>
                                        {admin.name || "N/A"}
                                        {admin._id === currentUserId && " (You)"}
                                        {currentCreatedBy?._id === admin._id && " (Creator)"}
                                    </span>
                                    {currentUserIsAdmin && admin._id !== currentUserId && (
                                        <button onClick={() => initiateAction('remove_admin', admin._id)} disabled={actionIsLoading} className="action-btn demote-admin-btn">
                                            Demote
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : <p>No administrators.</p>}
                    <hr />

                    <h3>Participants ({participantsToRender.length})</h3>
                    {participantsToRender.length > 0 ? (
                        <ul className="user-list member-list">
                            {participantsToRender.map(member => {
                                if (!member?._id) return null;
                                const isMemberAdmin = adminsToRender.some(admin => admin._id === member._id);
                                const showMakeAdminButton = currentUserIsAdmin && !isMemberAdmin && member._id !== currentUserId;
                                const showRemoveButton = (member._id === currentUserId) || (currentUserIsAdmin && member._id !== currentUserId);
                                return (
                                    <li key={member._id} className="user-list-item member-item">
                                        <div className="member-info">
                                            <img src={member.profilePicture || '/default-avatar.png'} alt={member.name} className="avatar-small" />
                                            <span>
                                                {member.name || "N/A"}
                                                {member._id === currentUserId && " (You)"}
                                                {isMemberAdmin && <span className="admin-badge">(Admin)</span>}
                                            </span>
                                        </div>
                                        <div className="member-actions">
                                            {showMakeAdminButton && (
                                                <button onClick={() => initiateAction('make_admin', member._id)} disabled={actionIsLoading} className="action-btn promote-admin-btn">
                                                    Make Admin
                                                </button>
                                            )}
                                            {showRemoveButton && (
                                                <button onClick={() => initiateAction('remove_member', member._id)} disabled={actionIsLoading} className="action-btn remove-member-btn">
                                                    {member._id === currentUserId ? 'Leave Group' : 'Remove'}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : <p>No participants.</p>}
                </div>
            </div>

            <ConfirmationModal
                isOpen={showConfirmation}
                title={confirmationData.title}
                message={confirmationData.message}
                onConfirm={handleConfirmedAction}
                onCancel={() => { 
                    setShowConfirmation(false); 
                    setConfirmationData({ title: '', message: '', confirmText: 'Confirm', actionTypeToConfirm: null, userIdToConfirm: null }); 
                }}
                confirmText={confirmationData.confirmText}
                isLoading={actionIsLoading}
            />

            {showAddMembersModal && currentUserIsAdmin && (
                 <AddMembersModal
                    chat={internalChatDetails}
                    onClose={() => {
                        console.log("[GroupInfoModal] Closing AddMembersModal via its onClose prop.");
                        setShowAddMembersModal(false);
                    }}
                    onGroupUpdated={handleMembersAdded}
                />
            )}
        </>
    );
};
export default GroupInfoModal;