#!/bin/bash
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install
nvm use

npm install -g yarn

yarn install

yarn lint

yarn run build

# These also need to be in the RiffRaff package
cp package.json target
cp riff-raff.yaml target

pushd target
# Ensures the RiffRaff package has the node_modules needed to run
yarn install --production
popd

yarn run package
