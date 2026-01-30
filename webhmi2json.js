import protobuf from 'protobufjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handling __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = process.argv[2];

if (!inputFile) {
    console.error('Usage: node webhmi2json.js <input_file.webhmi>');
    process.exit(1);
}

const inputPath = path.resolve(inputFile);
const protoPath = path.join(__dirname, 'webhmi.proto');

if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

if (!fs.existsSync(protoPath)) {
    console.error(`Proto definition not found: ${protoPath}`);
    process.exit(1);
}

// Load the proto definition
protobuf.load(protoPath, (err, root) => {
    if (err) {
        console.error('Failed to load proto file:', err);
        process.exit(1);
    }

    // Obtain the message type
    const GetDbResponse = root.lookupType('webhmi.GetDbResponse');

    try {
        // Read the file
        const buffer = fs.readFileSync(inputPath);

        // Decode (from binary)
        const message = GetDbResponse.decode(buffer);

        // Convert to plain object
        // Options allow controlling how fields are output (e.g. enums as strings)
        const object = GetDbResponse.toObject(message, {
            longs: String,
            enums: String,
            bytes: String,
            defaults: true, // Output default values (optional, can be removed)
            arrays: true,
            objects: true,
        });

        const jsonOutput = JSON.stringify(object, null, 2);

        // Construct output filename: replace .webhmi with .json, or append .json
        let outputPath;
        if (inputPath.toLowerCase().endsWith('.webhmi')) {
            outputPath = inputPath.substring(0, inputPath.length - 7) + '.json';
        } else {
            outputPath = inputPath + '.json';
        }

        fs.writeFileSync(outputPath, jsonOutput);
        console.log(`Successfully converted to: ${outputPath}`);

    } catch (e) {
        console.error('Conversion failed. Is the file a valid Protobuf encoded .webhmi file?');
        console.error('Error details:', e.message);
        process.exit(1);
    }
});
