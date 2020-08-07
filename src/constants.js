// @flow

export const PULL_REQUEST = 'pull_request';
export const PUSH = 'push';
export const COMMENT = 'issue_comment';
export const NOTIFIED = 'NOTIFIED';
export const REVIEWERS = 'REVIEWERS';

export const ENV_ADMIN_TOKEN = 'ADMIN_PERMISSION_TOKEN';
export const ENV_GITHUB_TOKEN = 'GITHUB_TOKEN';
export const ENV_EVENT = 'EVENT';

export const GERALD_IGNORE_FILE = '.geraldignore';
export const GIT_IGNORE_FILE = '.gitignore';
export const NOTIFIED_FILE = '.github/NOTIFIED';
export const REVIEWERS_FILE = '.github/NOTIFIED';

export const COMMENT_SYMBOL = '#';

export const GERALD_COMMENT_HEADER = '# Gerald:\n\n';
export const GERALD_COMMENT_NOTIFIED_HEADER = 'Notified:\n';
export const GERALD_COMMENT_REVIEWERS_HEADER = 'Reviewers:\n';
export const GERALD_COMMENT_REQ_REVIEWERS_HEADER = 'Required reviewers:\n';
export const GERALD_COMMENT_FOOTER =
    "\n__________________________________________________________________________________________________________________________________\n_Don't want to be involved in this pull request? Comment `#removeme` and we won't notify you of further changes._";

export const MATCH_REGEX_REGEX = /^"\/(.*?)\/([a-z]*)"$/;
export const MATCH_PULL_REQUEST_SECTION_HEADER_REGEX = /\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm;
export const MATCH_PUSH_SECTION_HEADER_REGEX = /\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm;
export const MATCH_PULL_REQUEST_TO_PUSH_SECTION_REGEX = /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*(?=\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\))/gm;
export const MATCH_JUST_PULL_REQUEST_SECTION_REGEX = /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*/gm;
export const MATCH_PATTERN_REGEX = /(.(?!  @))*/;
export const MATCH_USERNAME_OR_TEAM_REGEX = /@([A-Za-z]*\/)?\S*/g;
export const MATCH_NON_COMMENT_LINES_REGEX = /^[^\#\n].*/gm;
export const MATCH_REMOVEME_TAG_REGEX = /\#removeme/i;
export const MATCH_GERALD_COMMENT_HEADER_REGEX = /^#Gerald:/;
export const MATCH_GIT_DIFF_FILE_NAME = /(?<=^a\/)\S*/;
export const MATCH_GIT_DIFF_FILE_SEPERATOR = /^diff --git /m;
export const MATCH_COMMENT_HEADER_REGEX = /^### (Reviewers:|Required reviewers:|Notified:)$/m;

export type Section = 'pull_request' | 'push';
export type GeraldFile = 'NOTIFIED' | 'REVIEWERS';
export type CommentHeaders = 'Reviewers:\n' | 'Required reviewers:\n' | 'Notified:\n';
