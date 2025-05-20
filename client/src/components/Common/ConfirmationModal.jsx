// client/src/components/Common/ConfirmationModal.jsx
import React from 'react';
// Make sure to have CSS for this modal to be visible. Example CSS was provided previously.
// import './ConfirmationModal.css';

const ConfirmationModal = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop confirmation-modal-backdrop" onClick={onCancel}>
            <div className="modal-content confirmation-modal-content" onClick={(e) => e.stopPropagation()}>
                <h4>{title || "Confirm Action"}</h4>
                <p>{message || "Are you sure you want to proceed?"}</p>
                <div className="confirmation-modal-actions">
                    <button onClick={onCancel} className="btn btn-secondary" disabled={isLoading}>
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="btn btn-danger" disabled={isLoading}>
                        {isLoading ? "Processing..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;