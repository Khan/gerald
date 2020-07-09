var _interopRequireDefault=require("@babel/runtime/helpers/interopRequireDefault");var _regenerator=_interopRequireDefault(require("@babel/runtime/regenerator"));var _extends2=_interopRequireDefault(require("@babel/runtime/helpers/extends"));var _require=require('../utils'),__maybeAddIfMatch=_require.__maybeAddIfMatch,__turnPatternIntoRegex=_require.__turnPatternIntoRegex,__parseUsername=_require.__parseUsername,__pushOrSetToBin=_require.__pushOrSetToBin,getNotified=_require.getNotified,getReviewers=_require.getReviewers,parseExistingComments=_require.parseExistingComments,getFileDiffs=_require.getFileDiffs,getFilteredLists=_require.getFilteredLists;var mockTestFileDiff="a/testFile b/testFile\nnew file mode 123456\nindex 0000000..1234567\n--- /dev/null\n+++ b/testFile\n@@ -0,0 +1,220 @@\n+this is a new line that was added\n-this is an old line that was removed\n";var mockOtherFileDiff="a/otherFile.js b/otherFile.js\nnew file mode 123456\nindex 0000000..1234567\n--- /dev/null\n+++ b/otherFile.js\n@@ -0,0 +1,220 @@\nexport const testFn = () => {\n-   console.log('hi');\n+   console.log('hello world');\n}\n";jest.mock('../execCmd.js',function(){return(0,_extends2.default)({},jest.requireActual('../execCmd.js'),{execCmd:function execCmd(cmd,args){return _regenerator.default.async(function execCmd$(_context){while(1){switch(_context.prev=_context.next){case 0:_context.next=2;return _regenerator.default.awrap(new Promise(function(res,rej){var string="diff --git "+mockTestFileDiff+"diff --git "+mockOtherFileDiff;process.nextTick(function(){return res(string);});}));case 2:return _context.abrupt("return",_context.sent);case 3:case"end":return _context.stop();}}},null,null,null,Promise);}});});describe('maybe add',function(){it('should work',function(){var pattern=/test/;var diffs={testFile:'a diff with the word test'};var name='testName';var bin={testName:[]};__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});pattern=/nonexistent/;__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile']});pattern=/existent/;diffs={otherFile:'the word existent exists in this diff'};__maybeAddIfMatch(pattern,name,diffs,bin);expect(bin).toEqual({testName:['testFile','otherFile']});});});describe('turn into regex',function(){it('should work',function(){var pattern='"/test/ig"';var result=__turnPatternIntoRegex(pattern);expect(result.flags.split('')).toEqual(expect.arrayContaining(['i','g']));expect(result.source).toEqual('test');});it('should work',function(){var pattern='"/look for "quotes"/img"';var result=__turnPatternIntoRegex(pattern);expect(result.flags.split('')).toEqual(expect.arrayContaining(['i','g','m']));});it('should error',function(){var pattern='/this is invalid/';try{__turnPatternIntoRegex(pattern);}catch(e){expect(e).toEqual(new Error("The RegExp: "+pattern+" isn't valid"));}});});describe('parse usernames',function(){it('should work',function(){var original='@yipstanley!';var result=__parseUsername(original);expect(result).toEqual({original:original,username:'@yipstanley',justName:'yipstanley',isRequired:true});});it('should work',function(){var original='@yipstanley';var result=__parseUsername(original);expect(result).toEqual({original:original,username:'@yipstanley',justName:'yipstanley',isRequired:false});});});describe('push or set to bin',function(){it('should work',function(){var bin={};var username='testName';var files=['file1','file2'];__pushOrSetToBin(bin,username,files);expect(bin).toEqual({testName:files});files=['file2','file3','file4'];__pushOrSetToBin(bin,username,files);expect(bin).toEqual({testName:['file1','file2','file3','file4']});});});describe('get notified',function(){it('should work',function(){var notifiedFile="# comment\n*                   @githubUser\n*.js                @yipstanley @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson\n\n## ON PUSH WITHOUT PULL REQUEST\n\n*.js                @owner";var filesChanged=['pr-notify.js','pr-notify.yml'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};expect(getNotified(filesChanged,fileDiffs,'pull_request',notifiedFile)).toEqual({'@yipstanley':['pr-notify.js'],'@githubUser':['pr-notify.js','pr-notify.yml'],'@testperson':['yaml.yml']});expect(getNotified(filesChanged,fileDiffs,'push',notifiedFile)).toEqual({'@owner':['.pr-notify.js']});});});describe('get reviewers',function(){it('should work',function(){var reviewersFile="# comment\n.github/**          @githubUser!\n*.js                @yipstanley! @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson";var filesChanged=['.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml','.github/NOTIFIED'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};var _getReviewers=getReviewers(filesChanged,fileDiffs,'yipstanley',reviewersFile),requiredReviewers=_getReviewers.requiredReviewers,reviewers=_getReviewers.reviewers;expect(reviewers).toEqual({'@githubUser':['.github/workflows/pr-notify.js'],'@testperson':['yaml.yml']});expect(requiredReviewers).toEqual({'@githubUser':['.github/NOTIFIED','.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml']});});});describe('get filtered lists',function(){it('should work',function(){var sampleFile="# comment\n.github/**          @githubUser!\n*.js                @yipstanley! @githubUser\n\"/test/ig\"          @testperson\n# *                 @otherperson\n\n## ON PUSH WITHOUT PULL REQUEST";var filesChanged=['.github/workflows/pr-notify.js','.github/workflows/pr-notify.yml','.github/NOTIFIED'];var fileDiffs={'yaml.yml':'this is a function that has added this test line'};var _getReviewers2=getReviewers(filesChanged,fileDiffs,'yipstanley',sampleFile),requiredReviewers=_getReviewers2.requiredReviewers,reviewers=_getReviewers2.reviewers;var notified=getNotified(filesChanged,fileDiffs,'pull_request',sampleFile);var _getFilteredLists=getFilteredLists(reviewers,requiredReviewers,notified,['yipstanley','testperson']),actualReviewers=_getFilteredLists.actualReviewers,teamReviewers=_getFilteredLists.teamReviewers;expect(actualReviewers).toEqual(expect.arrayContaining(['githubUser']));});});describe('parse existing comments',function(){it('should work',function(){var gerald={user:{login:'github-actions[bot]'},body:"# Gerald:\n\n            ## Notified:\n\n            ## Reviewers:\n\n            ## Required reviewers:"};var existingComments={data:[gerald,{user:{login:'github-actions[bot]'},body:'irrelevant comment'},{user:{login:'github-actions[bot]'},body:'another irrelevant comment'},{user:{login:'yipstanley'},body:'#removeme'},{user:{login:'github-actions[bot]'},body:'Required Reviewers:\n\n:'},{user:{login:'github-actions[bot]'},body:'Reviewers:\n\n:'}]};var _parseExistingComment=parseExistingComments(existingComments),megaComment=_parseExistingComment.megaComment,removedJustNames=_parseExistingComment.removedJustNames;expect(megaComment).toEqual(megaComment);expect(removedJustNames).toEqual(['yipstanley']);});});describe('test get file diffs',function(){it('should work',function _callee(){var result;return _regenerator.default.async(function _callee$(_context2){while(1){switch(_context2.prev=_context2.next){case 0:_context2.next=2;return _regenerator.default.awrap(getFileDiffs(''));case 2:result=_context2.sent;expect(result['testFile']).toEqual(mockTestFileDiff);expect(result['otherFile.js']).toEqual(mockOtherFileDiff);case 5:case"end":return _context2.stop();}}},null,null,null,Promise);});});