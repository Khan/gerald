// @flow

// GitHub and GitHub Action Constants
export const PULL_REQUEST = 'pull_request';
export const PUSH = 'push';
export const COMMENT = 'issue_comment';
export const ENV_ADMIN_TOKEN = 'ADMIN_PERMISSION_TOKEN';
export const ENV_GITHUB_TOKEN = 'GITHUB_TOKEN';
export const ENV_EVENT = 'EVENT';

// Gerald Filepaths and Filenames
export const GERALD_IGNORE_FILE = '.geraldignore';
export const GIT_IGNORE_FILE = '.gitignore';
export const NOTIFIED_FILE = '.github/NOTIFIED';
export const REVIEWERS_FILE = '.github/REVIEWERS';
export const NOTIFIED = 'NOTIFIED';
export const REVIEWERS = 'REVIEWERS';
export const COMMENT_SYMBOL = '#';

// Gerald Comment Headers and Footers
export const GERALD_COMMENT_HEADER = '# Gerald:\n\n';
export const GERALD_COMMENT_NOTIFIED_HEADER = 'Notified:\n';
export const GERALD_COMMENT_REVIEWERS_HEADER = 'Reviewers:\n';
export const GERALD_COMMENT_REQ_REVIEWERS_HEADER = 'Required reviewers:\n';
export const GERALD_COMMENT_FOOTER =
    "\n__________________________________________________________________________________________________________________________________\n_Don't want to be involved in this pull request? Comment `#removeme` and we won't notify you of further changes._";
export const GERALD_COMMIT_COMMENT_HEADER = 'Notify of Push Without Pull Request\n\n';

// Git Diff Regexes
export const MATCH_GIT_DIFF_FILE_NAME = /(?<=^a\/)\S*/;
export const MATCH_GIT_DIFF_FILE_SEPERATOR = /^diff --git /m;

// Gerald Comment Regexes
export const MATCH_REMOVEME_TAG_REGEX = /\#removeme/i;
export const MATCH_GERALD_COMMENT_HEADER_REGEX = /^# Gerald:/;
export const MATCH_COMMENT_HEADER_REGEX = /^### (Reviewers:|Required reviewers:|Notified:)$/m;

// Gerald Files Regexes
export const MATCH_REGEX_REGEX = /^"\/(.*?)\/([a-z]*)"$/;
export const MATCH_PATTERN_REGEX = /(.(?! +@))*./;
export const MATCH_USERNAME_OR_TEAM_REGEX = /@([A-Za-z]*\/)?\S*/g;
export const MATCH_NON_COMMENT_LINES_REGEX = /^[^\#\n].*/gm;
export const MATCH_PULL_REQUEST_SECTION_HEADER_REGEX = /\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm;
export const MATCH_PUSH_SECTION_HEADER_REGEX = /\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm;
export const MATCH_PULL_REQUEST_TO_PUSH_SECTION_REGEX = /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*(?=\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\))/gm;
export const MATCH_JUST_PULL_REQUEST_SECTION_REGEX = /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*/gm;
export const MATCH_JUST_PUSH_SECTION_REGEX = /(?<=\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*/gm;
export const MATCH_USE_FILE_CONTENTS_REGEX = /--match-contents\s*$/;
