// server/routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const CloudConvert = require('cloudconvert');
const dotenv = require('dotenv');

// Load .env variables from project root (where .env should be)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Initialize CloudConvert
const useSandbox = process.env.CLOUDCONVERT_SANDBOX === 'true';
const apiKey = useSandbox ? process.env.SANDBOX_API_KEY : process.env.CLOUDCONVERT_API_KEY;

let cloudConvertInstance = null; // Initialize as null
if (apiKey) {
    try {
        cloudConvertInstance = new CloudConvert(apiKey, useSandbox);
        console.log(`CloudConvert initialized. Sandbox mode: ${useSandbox}`);
    } catch (error) {
        console.error("Error initializing CloudConvert SDK:", error);
        // Keep cloudConvertInstance as null, requests will fail gracefully
    }
} else {
    console.error("CloudConvert API Key (Live or Sandbox) is NOT SET in environment variables. Conversion will be disabled.");
}


// Multer setup for temporary conversion uploads
const tempStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempUploadPath = path.join(__dirname, '..', '..', 'temp_uploads');
        if (!fs.existsSync(tempUploadPath)) {
            try {
                fs.mkdirSync(tempUploadPath, { recursive: true });
            } catch (mkdirErr) {
                return cb(mkdirErr);
            }
        }
        cb(null, tempUploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const tempUpload = multer({
    storage: tempStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // CloudConvert free tier might have smaller limits
    fileFilter: function(req, file, cb) {
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type for conversion attempt.'), false);
        }
    }
});

// POST /api/files/convert
router.post('/convert', (req, res) => {
    if (!cloudConvertInstance) {
        console.error("/api/files/convert: CloudConvert not initialized (API Key missing or SDK error).");
        return res.status(503).json({ message: 'File conversion service is currently unavailable due to configuration issues.' });
    }

    tempUpload.single('file')(req, res, async function (multerErr) {
        if (multerErr) {
            console.error('Multer error during temp upload for conversion:', multerErr.message);
            return res.status(400).json({ message: multerErr.message || 'File upload error for conversion.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided for conversion.' });
        }

        const { targetFormat } = req.body;
        const inputPath = req.file.path;
        const originalName = req.file.originalname;
        const originalNameWithoutExt = path.parse(originalName).name;

        let outputFileName;
        let outputPathInMainUploads;
        let outputMimeType;

        console.log(`CloudConvert: Request to convert '${originalName}' to '${targetFormat}'. Temp file: ${inputPath}`);

        try {
            if (!targetFormat || (targetFormat !== 'pdf' && targetFormat !== 'docx')) {
                throw new Error('Invalid target conversion format specified (must be "pdf" or "docx").');
            }

            let job = await cloudConvertInstance.jobs.create({
                tasks: {
                    'import-my-file': { operation: 'import/upload' },
                    'convert-my-file': {
                        operation: 'convert',
                        input: 'import-my-file',
                        output_format: targetFormat,
                        engine: (targetFormat === 'pdf' && originalName.toLowerCase().endsWith('.docx')) ? 'office' : undefined, // Suggest 'office' engine for docx to pdf
                        // engine_version: 'latest', // Optional
                    },
                    'export-my-file': {
                        operation: 'export/url',
                        input: 'convert-my-file',
                        inline: false,
                    }
                }
            });
            // console.log("CloudConvert: Job created with ID:", job.id);

            const uploadTask = job.tasks.find(task => task.name === 'import-my-file');
            if (!uploadTask || !uploadTask.result || !uploadTask.result.form) {
                throw new Error('CloudConvert: Could not find upload task/form in job response.');
            }
            const inputFileStream = fs.createReadStream(inputPath);
            await cloudConvertInstance.tasks.upload(uploadTask, inputFileStream, originalName);
            // console.log("CloudConvert: File uploaded to import task.");

            job = await cloudConvertInstance.jobs.wait(job.id);
            // console.log("CloudConvert: Job finished with status:", job.status);

            if (job.status === 'error') {
                const errorTasks = job.tasks.filter(task => task.status === 'error');
                let errorMessage = 'CloudConvert job processing failed.';
                if (errorTasks.length > 0 && errorTasks[0].message) {
                    errorMessage = `CloudConvert Error: ${errorTasks[0].message}`;
                    if(errorTasks[0].code) errorMessage += ` (Code: ${errorTasks[0].code})`;
                }
                console.error("CloudConvert: Job error details:", JSON.stringify(errorTasks, null, 2));
                throw new Error(errorMessage);
            }

            const exportTask = job.tasks.find(task => task.name === 'export-my-file' && task.status === 'finished');
            if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
                throw new Error('CloudConvert: Export task did not complete or no files found.');
            }

            const convertedFileCloudData = exportTask.result.files[0];
            // console.log("CloudConvert: Export task successful. File URL:", convertedFileCloudData.url);

            outputFileName = convertedFileCloudData.filename || `${originalNameWithoutExt}-${Date.now()}.${targetFormat}`;
            outputPathInMainUploads = path.join(__dirname, '..', 'uploads', outputFileName);

            const response = await fetch(convertedFileCloudData.url);
            if (!response.ok) throw new Error(`Failed to download converted file from CloudConvert: ${response.statusText}`);
            
            const fileArrayBuffer = await response.arrayBuffer();
            fs.writeFileSync(outputPathInMainUploads, Buffer.from(fileArrayBuffer));
            console.log(`CloudConvert: Converted file saved to ${outputPathInMainUploads}`);

            if (targetFormat === 'pdf') outputMimeType = 'application/pdf';
            else if (targetFormat === 'docx') outputMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else outputMimeType = 'application/octet-stream';

            const stats = fs.statSync(outputPathInMainUploads);
            const finalFileUrl = `${req.protocol}://${req.get('host')}/uploads/${outputFileName}`;

            return res.json({
                message: 'File converted successfully via CloudConvert.',
                newFileName: outputFileName,
                newMimeType: outputMimeType,
                newFileUrl: finalFileUrl,
                newFileSize: stats.size,
            });

        } catch (error) {
            console.error('SERVER CATCH BLOCK: CloudConvert process error:', error.message);
            console.error('SERVER CATCH BLOCK: Stack:', error.stack);
            if (!res.headersSent) {
                return res.status(500).json({ message: `${error.message || 'Internal server error during CloudConvert process.'}` });
            }
        } finally {
            if (inputPath && fs.existsSync(inputPath)) {
                fs.unlink(inputPath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting temporary input file:", inputPath, unlinkErr);
                });
            }
        }
    });
});

module.exports = router;