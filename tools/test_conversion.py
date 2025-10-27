#!/usr/bin/env python3
"""
Test StarDict to SQLite conversion using PyGlossary
"""

import os
import sys
import requests
import tarfile
import gzip
import sqlite3
from pathlib import Path

def download_test_dict():
    """Download a small test dictionary"""
    url = "https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz"
    print(f"📥 Downloading test dictionary: spa-eng (small: ~0.1MB)")
    
    response = requests.get(url)
    response.raise_for_status()
    
    with open("test-dict.tar.xz", "wb") as f:
        f.write(response.content)
    
    print(f"✅ Downloaded {len(response.content)} bytes")
    return "test-dict.tar.xz"

def extract_dict(archive_path):
    """Extract StarDict archive"""
    print(f"📂 Extracting {archive_path}")
    
    with tarfile.open(archive_path, 'r:xz') as tar:
        tar.extractall()
    
    # Find the extracted directory
    for item in os.listdir('.'):
        if os.path.isdir(item) and item != '__pycache__':
            print(f"📁 Found directory: {item}")
            return item
    
    raise Exception("No directory found after extraction")

def prepare_stardict_files(dict_dir):
    """Decompress and prepare StarDict files"""
    print(f"🔧 Preparing StarDict files in {dict_dir}")
    
    # Find the base name
    ifo_files = list(Path(dict_dir).glob("*.ifo"))
    if not ifo_files:
        raise Exception("No .ifo file found")
    
    base_name = ifo_files[0].stem
    print(f"📖 Dictionary base name: {base_name}")
    
    # Decompress files if needed
    dict_dz = Path(dict_dir) / f"{base_name}.dict.dz"
    idx_gz = Path(dict_dir) / f"{base_name}.idx.gz"
    
    if dict_dz.exists():
        print(f"🗜️ Decompressing {dict_dz}")
        with gzip.open(dict_dz, 'rb') as gz_file:
            with open(Path(dict_dir) / f"{base_name}.dict", 'wb') as out_file:
                out_file.write(gz_file.read())
    
    if idx_gz.exists():
        print(f"🗜️ Decompressing {idx_gz}")
        with gzip.open(idx_gz, 'rb') as gz_file:
            with open(Path(dict_dir) / f"{base_name}.idx", 'wb') as out_file:
                out_file.write(gz_file.read())
    
    # Verify all files exist
    required_files = [
        Path(dict_dir) / f"{base_name}.ifo",
        Path(dict_dir) / f"{base_name}.idx", 
        Path(dict_dir) / f"{base_name}.dict"
    ]
    
    for file_path in required_files:
        if not file_path.exists():
            raise Exception(f"Missing required file: {file_path}")
        print(f"✅ Found: {file_path} ({file_path.stat().st_size} bytes)")
    
    return str(Path(dict_dir) / f"{base_name}.ifo")

def test_pyglossary_conversion(ifo_path, output_path):
    """Test PyGlossary conversion"""
    print(f"🔄 Testing PyGlossary conversion: {ifo_path} -> {output_path}")
    
    try:
        # Try importing PyGlossary
        from pyglossary import Glossary
        print("✅ PyGlossary imported successfully")
        
        # Create glossary object
        glos = Glossary()
        
        # Try to read StarDict
        print("📖 Reading StarDict...")
        glos.read(ifo_path)
        print(f"✅ StarDict read successfully, entries: {len(glos)}")
        
        # Try to write SQLite
        print("💾 Writing SQLite...")
        glos.write(output_path)
        print(f"✅ SQLite written successfully")
        
        return True
        
    except ImportError as e:
        print(f"❌ PyGlossary import failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        return False

def verify_sqlite(db_path):
    """Verify SQLite database"""
    print(f"🔍 Verifying SQLite database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"📊 Tables: {[t[0] for t in tables]}")
        
        # Check entries in main table (usually 'word' or 'dict')
        for table_name in ['word', 'dict', 'entries']:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                count = cursor.fetchone()[0]
                print(f"📈 {table_name} table: {count} entries")
                
                # Sample a few entries
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
                samples = cursor.fetchall()
                print(f"📝 Sample entries: {samples}")
                break
                
            except sqlite3.OperationalError:
                continue
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ SQLite verification failed: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 StarDict to SQLite Conversion Test")
    print("=" * 50)
    
    # Create test directory
    test_dir = Path("conversion_test")
    test_dir.mkdir(exist_ok=True)
    os.chdir(test_dir)
    
    try:
        # Step 1: Download test dictionary
        archive_path = download_test_dict()
        
        # Step 2: Extract archive
        dict_dir = extract_dict(archive_path)
        
        # Step 3: Prepare StarDict files
        ifo_path = prepare_stardict_files(dict_dir)
        
        # Step 4: Test conversion
        output_path = "test_output.sqlite"
        success = test_pyglossary_conversion(ifo_path, output_path)
        
        if success:
            # Step 5: Verify output
            verify_sqlite(output_path)
            print("\n✅ CONVERSION TEST SUCCESSFUL!")
            print(f"📁 Output: {Path.cwd() / output_path}")
        else:
            print("\n❌ CONVERSION TEST FAILED!")
            return 1
            
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    
    finally:
        os.chdir("..")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())