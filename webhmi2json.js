import protobuf from 'protobufjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/*
 * Usage:
 *   node webhmi2json.js <input_file.webhmi>
 *
 * Example:
 *   node webhmi2json.js mode1.webhmi
 *
 * The script decodes the exported .webhmi protobuf file with webhmi.proto and
 * writes a pretty-printed JSON file next to it. For example, mode1.webhmi will
 * be converted to mode1.json.
 */

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
const FLOAT_DECIMAL_PLACES = 6;

if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

if (!fs.existsSync(protoPath)) {
    console.error(`Proto definition not found: ${protoPath}`);
    process.exit(1);
}

const cleanFloatNoise = (value) => {
    if (Array.isArray(value)) {
        return value.map(cleanFloatNoise);
    }

    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [key, childValue] of Object.entries(value)) {
            out[key] = cleanFloatNoise(childValue);
        }
        return out;
    }

    if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
        return Number(value.toFixed(FLOAT_DECIMAL_PLACES));
    }

    return value;
};

// Load the proto definition
protobuf.load(protoPath, (err, root) => {
    if (err) {
        console.error('Failed to load proto file:', err);
        process.exit(1);
    }

    // Current exported .webhmi files use DeviceConfig.
    const DeviceConfig = root.lookupType('webhmi.DeviceConfig');

    const toPlainObjectOptions = {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true,
        objects: true,
    };

    try {
        // Read the file
        const buffer = fs.readFileSync(inputPath);

        // Decode current app exports.
        const message = DeviceConfig.decode(buffer);
        const object = cleanFloatNoise(DeviceConfig.toObject(message, toPlainObjectOptions));

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
