# Documentation on the backend

## Coding Principles
| Nr. | Principle | ToDo |
|----:|---------------| --- |
|    1| Simplicity in configuration ( most in env variables) | Provide current documentation in this readme |
|    2| Provide GMCP-Configuration via GMCP | 1) move from cfg file to GMCP |
| | | 2) check generic versus specific implementation |
|    3| Mud Configuration via cetral Repo e.g. unitopia.de/webmud3/api/mudrepo | Load at startup from Repo with fallback to local file |


## Envirionement Variables
| Env-Variable | Purpose | Default |
| ------------ | ------- | ------- |
| NODE_ENV | definition development and production => loads backend/config/config.[NODE_ENV] | development |
| TLS, TLS_CERT, TLS_KEY | definition of TLS protocoll, certificate and key file for mud Communication | not encryptet |
| SECRET_CONFIG | file path to configuration file for socket and datbases | /run/secret_source.json or default behaviour (obsolete => move to env variables)
| MY_LOG_DB | obsolete | obsolete |
| WEBMUD3_DISTRIBUTION_TYPE | replaced by WEBMUD3_MANIFEST_FILE | no manifest |
| WEBMUD3_MANIFEST_FILE | select one of multiple manifest files for current docker container PWA | deliver no manifest |
| SOCKETFILE | obsolete | /run/sockets/testintern2 |

## Configuration files
| Name and Path | Purpose | ToDo |
| ------------- | ------- | ---- |
| config\config.global.js | Environement variables TLS;TLS_CERT,TLS_KEY into the config object | ok? |
| config\config.development.js | config.whitelist with valid localhost addresses | is this still in use? |
| \config\config.production.js | whitelist for unitopia and untopia/webmud3 | still in use or adapt for other muds? |
| /run/secret_sauce.json | 3 Socket variables and a db path | move to env variables |
| /run/mud_config.json | Default fallback file for env variable MD_CONFIG | 1. local file or web address for central repo |
| | | 2. move GMCP config totally to GMCP core messages |
| /run/sockets/testintern2 | unused socketfile / md rpc | obsolete? |

## pathes provided by the backend
| Name and Path | Purpose | ToDo |
| ------------- | ------- | ---- |
| /socket.io-client/dist/* | Hosting socket.io files for client | check if dependancy or get from backend, not both! |
| /manifest.webmanifes | provides depending on the WEBMUD3_DISTRIBUTION_TYPE different manifest files for PWA | => variable WEBMuD3_MANIFEST_FILE |
| /ace/* | eeditor files for ace editor | check dependencies or download not both |
| /api/auth/login [Get,Post], /api/auth/logout [Post] | preparation for the views or platform login |combine with dbus and/or oauth |
| /config/mud_config.json | the backend provision the current mud configuration to the frontend | only mud repo, gmcp config moves to gmcp |
| * | dist provisioning | ok |




