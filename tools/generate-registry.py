#!/usr/bin/env python3
"""
Generate registry.json for dictionary packs
Scans current directory for .zip and .json files and creates a registry
"""

import json
import os
import glob
from pathlib import Path

def get_file_size(filepath):
    """Get file size in bytes"""
    try:
        return os.path.getsize(filepath)
    except:
        return 0

def generate_registry():
    """Generate registry.json from files in current directory"""
    
    registry = {
        "version": "1.0",
        "timestamp": "",
        "packs": []
    }
    
    # Find all .zip files in current directory
    zip_files = glob.glob("*.zip")
    
    for zip_file in sorted(zip_files):
        # Extract pack name (remove .sqlite.zip suffix)
        pack_name = zip_file.replace('.sqlite.zip', '').replace('.zip', '')
        
        # Look for corresponding .json metadata file
        json_file = f"{pack_name}.json"
        metadata = {}
        
        if os.path.exists(json_file):
            try:
                with open(json_file, 'r') as f:
                    metadata = json.load(f)
            except:
                pass
        
        # Get file size
        size_bytes = get_file_size(zip_file)
        size_mb = round(size_bytes / (1024 * 1024), 1)
        
        # Determine languages from pack name
        if '-' in pack_name:
            parts = pack_name.split('-')
            if len(parts) == 2:
                source_lang = parts[0]
                target_lang = parts[1]
            else:
                source_lang = pack_name
                target_lang = "unknown"
        else:
            source_lang = pack_name
            target_lang = "unknown"
        
        pack_entry = {
            "id": pack_name,
            "name": f"{source_lang.upper()}-{target_lang.upper()} Dictionary",
            "source_language": source_lang,
            "target_language": target_lang,
            "type": "bilingual",
            "format": "sqlite",
            "file": zip_file,
            "size_bytes": size_bytes,
            "size_mb": size_mb,
            "entries": metadata.get("entries", 0),
            "source": metadata.get("source", "Wiktionary"),
            "version": metadata.get("version", "1.0"),
            "description": metadata.get("description", f"Bilingual dictionary for {source_lang} to {target_lang} translation")
        }
        
        registry["packs"].append(pack_entry)
    
    # Set timestamp
    import datetime
    registry["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    return registry

if __name__ == "__main__":
    registry = generate_registry()
    print(json.dumps(registry, indent=2, ensure_ascii=False))