// src/components/Chat/FileUploadConfirmationDialog.jsx
import React, { useState, useEffect } from 'react';
import './FileUploadConfirmationDialog.css'; // Ensure this CSS file exists and is styled

const YOUR_BACKEND_CONVERT_ENDPOINT = 'http://localhost:5001/api/files/convert';

const FileUploadConfirmationDialog = ({
    isOpen,
    file, // This is the *original* File object selected by the user
    onConfirm,
    onCancel,
    isActuallyUploading, // True when ChatPage is performing the FINAL upload/send after this dialog
}) => {
    const [caption, setCaption] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    // currentFileForDisplay holds the details of the file to be shown and potentially shared
    // It can be the original 'file' prop (a File object) or details of a converted file.
    const [currentFileForDisplay, setCurrentFileForDisplay] = useState(null);
    const [isConverting, setIsConverting] = useState(false); // Local state for conversion process
    const [conversionError, setConversionError] = useState(null);

    useEffect(() => {
        // This effect syncs currentFileForDisplay with the incoming 'file' prop when the dialog opens
        // or when the 'file' prop itself changes. It also resets conversion-related states.
        if (isOpen && file) {
            // console.log("FileUploadConfirmationDialog: useEffect detected isOpen and file. Initial file:", file.name, "Type:", file.type);
            setCurrentFileForDisplay(file); // Always start with the original file when dialog opens or 'file' changes
            setConversionError(null);     // Clear previous conversion errors
            setIsConverting(false);       // Reset conversion state
            setCaption('');               // Reset caption

            // Generate preview URL for images and videos from the original file object
            if (file instanceof File && (file.type?.startsWith('image/') || file.type?.startsWith('video/'))) {
                const objectUrl = URL.createObjectURL(file);
                setPreviewUrl(objectUrl);
                // console.log("FileUploadConfirmationDialog: Created preview URL for original file:", objectUrl);
                return () => {
                    URL.revokeObjectURL(objectUrl);
                    // console.log("FileUploadConfirmationDialog: Revoked preview URL for original file:", objectUrl);
                };
            } else {
                setPreviewUrl(null);
            }
        } else if (!isOpen) {
            // Reset all local state when the dialog is closed
            // console.log("FileUploadConfirmationDialog: useEffect detected dialog is not open. Resetting local states.");
            setPreviewUrl(null);
            setCaption('');
            setCurrentFileForDisplay(null);
            setConversionError(null);
            setIsConverting(false);
        }
    }, [file, isOpen]); // Re-run if the original file prop changes or if the dialog opens/closes

    const handleConfirmShare = () => {
        // console.log("FileUploadConfirmationDialog: Share button clicked. Sharing file:", currentFileForDisplay, "Caption:", caption);
        onConfirm(currentFileForDisplay, caption);
    };

    const handleAttemptConvertFile = async (targetFormatValue) => { // Renamed parameter for clarity
        if (!currentFileForDisplay || !(currentFileForDisplay instanceof File) || isConverting || isActuallyUploading) {
            if (currentFileForDisplay && currentFileForDisplay.isConverted) {
                 setConversionError("File already converted. To convert original, please cancel and re-attach.");
            } else if (isConverting) {
                console.warn("FileUploadConfirmationDialog: Conversion already in progress.");
            } else if (isActuallyUploading) {
                console.warn("FileUploadConfirmationDialog: Cannot convert while final share is in progress.");
            } else if (!currentFileForDisplay || !(currentFileForDisplay instanceof File)) {
                console.warn("FileUploadConfirmationDialog: No valid original file to convert.");
                setConversionError("Cannot convert: No valid original file is selected for conversion.");
            }
            return;
        }

        console.log(`FileUploadConfirmationDialog: Attempting to convert '${currentFileForDisplay.name}' to ${targetFormatValue}`);
        setIsConverting(true);
        setConversionError(null);

        const formData = new FormData();
        formData.append('file', currentFileForDisplay); // Send the original File object
        formData.append('targetFormat', targetFormatValue); // Use the parameter directly

        try {
            const response = await fetch(YOUR_BACKEND_CONVERT_ENDPOINT, {
                method: 'POST',
                body: formData,
                // headers: { 'Authorization': `Bearer ${token}` }, // If auth is needed
            });

            let responseData;
            try {
                responseData = await response.json(); // Attempt to parse JSON, even for errors
            } catch (jsonParseError) {
                // If JSON parsing fails, the response was likely not JSON (e.g. HTML error page or empty)
                console.error("FileUploadConfirmationDialog: Failed to parse server response as JSON.", jsonParseError);
                const responseText = await response.text().catch(() => "Could not read server response text (response was likely empty or unreadable).");
                console.error("FileUploadConfirmationDialog: Server response text:", responseText);
                // Throw a new error with a more generic message but log the details
                throw new Error(`Server error ${response.status}. Response was not valid JSON. Check console for server response text.`);
            }


            if (!response.ok) {
                // If response is not OK, use message from parsed JSON if available, or construct one
                const errorMessage = responseData?.message || `Server responded with ${response.status}: ${response.statusText || 'Unknown server error during conversion.'}`;
                console.error("FileUploadConfirmationDialog: Server returned an error during conversion:", response.status, responseData);
                throw new Error(errorMessage);
            }

            // If response.ok, responseData should be the successful conversion details
            console.log("FileUploadConfirmationDialog: Conversion successful. Server response:", responseData);

            const convertedFileDetails = {
                name: responseData.newFileName,
                type: responseData.newMimeType,
                size: responseData.newFileSize,
                uploadableUrl: responseData.newFileUrl, // This is the URL to the converted & stored file
                isConverted: true, // Flag to indicate this is details of a converted file
            };
            setCurrentFileForDisplay(convertedFileDetails); // Update state to show converted file details
            setPreviewUrl(null); // Original blob preview is no longer valid for the converted file
            // If the converted file is an image/video and you want to preview it, you'd set previewUrl = convertedFileDetails.uploadableUrl
            if (convertedFileDetails.type?.startsWith('image/') || convertedFileDetails.type?.startsWith('video/')) {
                setPreviewUrl(convertedFileDetails.uploadableUrl);
            }

            console.log("FileUploadConfirmationDialog: Display updated to show converted file details:", convertedFileDetails);

        } catch (error) {
            // This catch handles errors from fetch itself (network error) OR errors explicitly thrown above
            console.error("FileUploadConfirmationDialog: Catch block in handleAttemptConvertFile. Error object:", error);
            setConversionError(error.message || "An unexpected client-side error occurred during conversion setup.");
        } finally {
            setIsConverting(false);
        }
    };

    const getFileIconForDisplay = (fileDetails) => {
        if (!fileDetails || (!fileDetails.type && !fileDetails.name)) return '❓'; // Unknown file icon
        const fileType = fileDetails.type || '';
        const fileName = fileDetails.name?.toLowerCase() || '';

        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.startsWith('video/')) return '🎬';
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) return '📄';
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType.startsWith('text/')) return '📝';
        if (fileType.includes('zip') || fileType.includes('archive') || fileType.includes('rar')) return '📦';
        if (fileType.includes('wordprocessingml') || fileType.includes('msword') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return '📃'; // Word
        if (fileType.includes('spreadsheetml') || fileType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return '📊'; // Excel
        if (fileType.includes('presentationml') || fileType.includes('powerpoint') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) return '🖥️'; // PowerPoint
        return '📁'; // Generic file
    };

    const formatFileSizeForDisplay = (bytes) => {
        if (bytes === undefined || bytes === null || isNaN(bytes)) return 'N/A';
        if (bytes === 0) return '0 KB';
        return `${parseFloat((bytes / 1024).toFixed(2))} KB`;
    };

    const canConvertToPdf = currentFileForDisplay instanceof File &&
                           (currentFileForDisplay.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                            currentFileForDisplay.type === 'application/msword' ||
                            currentFileForDisplay.name?.toLowerCase().endsWith('.docx') ||
                            currentFileForDisplay.name?.toLowerCase().endsWith('.doc'));

    const PDF_TO_DOCX_FEATURE_ENABLED = true; // Set to true to make the button clickable for testing server 501

    const canConvertToDocx = currentFileForDisplay instanceof File &&
                             currentFileForDisplay.type === 'application/pdf';


    if (!isOpen || !currentFileForDisplay) {
        return null;
    }

    const disableAllActions = isActuallyUploading || isConverting;

    return (
        <div className="confirmation-dialog-overlay">
            <div className="confirmation-dialog">
                <h2>Confirm File Share</h2>
                <div className="file-preview-area">
                    {previewUrl && (currentFileForDisplay.type?.startsWith('image/') || (currentFileForDisplay.isConverted && currentFileForDisplay.type?.startsWith('image/'))) && (
                        <img src={previewUrl} alt="Preview" className="file-preview-image" />
                    )}
                    {previewUrl && (currentFileForDisplay.type?.startsWith('video/') || (currentFileForDisplay.isConverted && currentFileForDisplay.type?.startsWith('video/'))) && (
                        <video src={previewUrl} controls className="file-preview-video" />
                    )}
                    {(!previewUrl || !(currentFileForDisplay.type?.startsWith('image/') || currentFileForDisplay.type?.startsWith('video/'))) && (
                         <div className="file-icon-large">{getFileIconForDisplay(currentFileForDisplay)}</div>
                    )}
                </div>

                <div className="file-details">
                    <p><strong>Name:</strong> {currentFileForDisplay.name || 'N/A'}</p>
                    <p><strong>Size:</strong> {formatFileSizeForDisplay(currentFileForDisplay.size)}</p>
                </div>

                {conversionError && <p className="conversion-error-message" style={{color: 'red', textAlign: 'center', marginBottom: '10px'}}>{conversionError}</p>}

                <div className="conversion-actions" style={{display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px'}}>
                    {canConvertToPdf && (
                        <button
                            onClick={() => handleAttemptConvertFile('pdf')}
                            disabled={disableAllActions}
                            className="convert-btn"
                        >
                            {isConverting && !(currentFileForDisplay?.isConverted && currentFileForDisplay?.type === 'application/pdf') ? 'Converting to PDF...' : 'Convert to PDF'}
                        </button>
                    )}
                    {canConvertToDocx && (
                        <button
                            onClick={() => handleAttemptConvertFile('docx')} 
                            disabled={disableAllActions || !PDF_TO_DOCX_FEATURE_ENABLED}
                            className="convert-btn"
                            title={!PDF_TO_DOCX_FEATURE_ENABLED ? "PDF to DOCX conversion is not currently supported" : "Convert this PDF to a DOCX document"}
                        >
                            {isConverting && currentFileForDisplay?.type === 'application/pdf' ? 'Converting to DOCX...' : 'Convert to DOCX'}
                        </button>
                    )}
                </div>

                <textarea
                    className="caption-input"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption (optional)..."
                    rows="3"
                    disabled={disableAllActions}
                />
                <div className="dialog-actions">
                    <button onClick={onCancel} disabled={disableAllActions} className="cancel-btn">Cancel</button>
                    <button onClick={handleConfirmShare} disabled={disableAllActions} className="share-btn">
                        {isActuallyUploading ? 'Sharing...' : (isConverting ? 'Processing...' : 'Share')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileUploadConfirmationDialog;