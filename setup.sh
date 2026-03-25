#!/bin/bash

# CG SDK Quick Setup Script

echo "🚀 Setting up CG SDK..."
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required"
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Build the SDK
echo "🔨 Building SDK..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ SDK built successfully"
echo ""

# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo "⚠️  Some tests failed, but continuing..."
else
    echo "✅ Tests passed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Get your API key from https://cognipeer.com"
echo "  2. Set environment variable: export CGATE_API_KEY=your-api-key"
echo "  3. Try an example: cd examples && npm install && npm run example:chat"
echo "  4. Read the docs: npm run docs:dev"
echo ""
echo "Happy coding! 🎉"
