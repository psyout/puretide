#!/bin/bash

# COA PDF Compression Script
# Reduces file size while maintaining readability

set -e

COA_DIR="public/coa"
BACKUP_DIR="public/coa-backup"
COMPRESSED_DIR="public/coa-compressed"

echo "🔧 Starting COA PDF compression..."

# Create directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$COMPRESSED_DIR"

# Backup original files
echo "📦 Backing up original files..."
cp "$COA_DIR"/*.pdf "$BACKUP_DIR/" 2>/dev/null || echo "No PDFs found in $COA_DIR"

# Check if Ghostscript is installed
if ! command -v gs &> /dev/null; then
    echo "❌ Ghostscript not found. Installing..."
    brew install ghostscript
fi

# Compress PDFs
echo "🗜️  Compressing PDFs..."
for file in "$COA_DIR"/*.pdf; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Processing $filename..."
        
        # Get original size
        original_size=$(stat -f%z "$file")
        
        # Compress with ebook quality (good balance)
        gs -sDEVICE=pdfwrite \
           -dCompatibilityLevel=1.4 \
           -dPDFSETTINGS=/ebook \
           -dNOPAUSE \
           -dQUIET \
           -dBATCH \
           -sOutputFile="$COMPRESSED_DIR/$filename" \
           "$file"
        
        # Get compressed size
        compressed_size=$(stat -f%z "$COMPRESSED_DIR/$filename")
        
        # Calculate reduction
        reduction=$(( (original_size - compressed_size) * 100 / original_size ))
        original_mb=$((original_size / 1024 / 1024))
        compressed_mb=$((compressed_size / 1024 / 1024))
        
        echo "    ✅ $original_mb MB → $compressed_mb MB (${reduction}% reduction)"
    fi
done

echo ""
echo "📊 Compression Summary:"
echo "  Original files: $BACKUP_DIR"
echo "  Compressed files: $COMPRESSED_DIR"
echo ""
echo "🔄 To replace originals with compressed versions:"
echo "  cp $COMPRESSED_DIR/*.pdf $COA_DIR/"
echo ""
echo "✅ Compression complete!"
