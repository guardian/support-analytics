#!/usr/bin/env bash

set -e

GITHUB_RUN_NUMBER="${GITHUB_RUN_NUMBER}"
BUILD_NUMBER=$((GITHUB_RUN_NUMBER + 50))

echo "GITHUB_RUN_NUMBER: $GITHUB_RUN_NUMBER"

if [ -z $BUILD_NUMBER ]; then BUILD_NUMBER="DEV"; fi
echo "Uploading riff-raff.yaml and cfn.yaml files to riffraff-artifact bucket"
echo "Build number: '$BUILD_NUMBER'"
mkdir -p $BUILD_NUMBER/component-event-stream-cloudformation
cp component-event-stream/cfn.yaml $BUILD_NUMBER/component-event-stream-cloudformation
cp component-event-stream/riff-raff.yaml $BUILD_NUMBER/

aws s3 cp --recursive $BUILD_NUMBER s3://riffraff-artifact/support:component-event-stream/$BUILD_NUMBER
rm -rf $BUILD_NUMBER/

now=`date -u +"%Y-%m-%dT%H:%M:%S.000Z"`
echo "
{
  \"projectName\": \"support:component-event-stream\",
  \"buildNumber\": \"$BUILD_NUMBER\",
  \"startTime\": \"$now\",
  \"vcsURL\": \"git@github.com:guardian/support-analytics.git\",
  \"branch\": \"$BUILD_VCS_BRANCH\",
  \"revision\": \"N/A\"
}
" > build.json
cat build.json
aws s3 cp build.json s3://riffraff-builds/support:$2/$BUILD_NUMBER/build.json

