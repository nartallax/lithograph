#!/bin/bash
set -e
cd `dirname "$0"`
cd ..

rm -rf target
rm -rf ts/generated
./node_modules/.bin/imploder --tsconfig tsconfig.json
cp ./package.json ./target/
cp ./LICENSE ./target/
cp ./README.MD ./target/