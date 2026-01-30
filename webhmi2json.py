import sys
import os
import subprocess
import json

def install_and_compile():
    """
    Attempts to compile the webhmi.proto file into a Python module (webhmi_pb2.py).
    """
    proto_file = "webhmi.proto"
    if not os.path.exists(proto_file):
        print(f"Error: {proto_file} not found in current directory.")
        sys.exit(1)

    print(f"Protobuf module not found or outdated. Attempting to compile {proto_file}...")

    # Check for protoc
    try:
        # Try compiling using standard protoc command
        result = subprocess.run(
            ["protoc", f"--python_out=.", proto_file],
            capture_output=True,
            text=True,
            shell=True 
        )
        
        if result.returncode != 0:
            print("Compilation failed.")
            print("Error output:", result.stderr)
            print("\nPlease ensure you have the Protocol Compiler installed and in your PATH.")
            print("Or install the python tools: pip install grpcio-tools")
            print("Then run: python -m grpc_tools.protoc -I. --python_out=. webhmi.proto")
            sys.exit(1)
            
        print("Compilation successful: webhmi_pb2.py created.")

    except FileNotFoundError:
        print("Error: 'protoc' command not found.")
        print("Please install the Protocol Buffers compiler or run manually.")
        sys.exit(1)

# --- Import Logic ---
try:
    import webhmi_pb2
    from google.protobuf.json_format import MessageToJson
except ImportError:
    install_and_compile()
    # Retry import after compilation
    try:
        import webhmi_pb2
        from google.protobuf.json_format import MessageToJson
    except ImportError:
        print("Error: Could not import webhmi_pb2 after compilation.")
        print("Make sure 'protobuf' library is installed: pip install protobuf")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python webhmi2json.py <input_file.webhmi>")
        sys.exit(1)

    input_file = sys.argv[1]
    
    if not os.path.exists(input_file):
        print(f"Error: File {input_file} not found.")
        sys.exit(1)

    try:
        # 1. Read the binary file
        with open(input_file, "rb") as f:
            data = f.read()

        # 2. Decode using the generated Protobuf class
        # According to webhmi.proto, the top-level message for getting DB is GetDbResponse
        # However, check if your file export used GetDbResponse or just DeviceDb.
        # Based on previous context (DeviceDemo.tsx), we used webhmi.GetDbResponse.encode(...).
        message = webhmi_pb2.GetDbResponse()
        message.ParseFromString(data)

        # 3. Convert to JSON
        # preserving_proto_field_name=False converts camelCase to snake_case usually, 
        # but JS implementation of protobuf often keeps camelCase if defined so in proto options or if using default.
        # Let's use preserving_proto_field_name=True to keep 'bleName' instead of 'ble_name' which matches the JS counterpart better.
        json_str = MessageToJson(
            message, 
            including_default_value_fields=True, 
            preserving_proto_field_name=True
        )
        
        # 4. Save to file
        base_name = os.path.splitext(input_file)[0]
        output_file = f"{base_name}.json"
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_str)

        print(f"Success! Converted {input_file} -> {output_file}")

    except Exception as e:
        print("Conversion Failed.")
        print(f"Error details: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
