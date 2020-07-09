#!/usr/bin/env node
require('@babel/register');var core=require('@actions/core');var _require=require('./main.js'),runPush=_require.runPush;try{runPush();}catch(error){core.setFailed(error.message);}