# webmud3 1.0.0 Alpha

[![Build and Test](https://github.com/unitopia-de/webmud3/actions/workflows/build_and_test.yml/badge.svg?branch=develop)](https://github.com/unitopia-de/webmud3/actions/workflows/build_and_test.yml)

Webmud3: third generation of the [UNItopia](https://www.unitopia.de) Webmud as open source project.

Webmud3 is a modern MUD (Multi-User Dungeon) client that consists of a NodeJS-based backend and a web-based frontend.
This client provides comprehensive support for Telnet and the protocols built on top of it, such as GMCP (Generic Mud Communication Protocol) and MXP (Mud eXtension Protocol), specifically designed for interaction with MUD servers.

## Features

Please note: most of these features have been tested against [UNItopia](https://www.unitopia.de). We can not guarantee all features are working with your MUD server.

- Telnet support

  Provides a flexible and customizable socket interface that can establish a Telnet connection to any MUD server. Telnet Options are negotiated as necessary.

  To see the full list of supported options and their negotiation status see the [Telnet Feature](./backend/src/features/telnet/README.md) page.

- ANSI support

  The received text is displayed with ANSI color codes, providing a colorful and user-friendly representation in the frontend.

  There is [work in progress](https://github.com/unitopia-de/webmud3/milestone/11).

- Reconnection

  The backend stays connected to the MUD even if the frontend is disconnected. This allows for seemless reconnections from the frontend. Every message received by the backend is cached meanwhile so nothing is lost.

- Mobile Support

  The frontend is (and should always be) mobile optimized.

## Roadmap

We are currently working on the following features:

- MXP Support

  [Milestone](https://github.com/unitopia-de/webmud3/milestone/8)

- GMCP Support

  _Not planned yet_

## Deployments

Currently, there is a [test deployment](https://unitopia-client.azurewebsites.net/) available. This deployment can be set for any given branch. To check which branch is currently deployed there, visit [Azure Deployments](https://github.com/unitopia-de/webmud3/actions/workflows/deploy_to_azure.yml).

[![Build and deploy to azure](https://github.com/unitopia-de/webmud3/actions/workflows/deploy_to_azure.yml/badge.svg)](https://github.com/unitopia-de/webmud3/actions/workflows/deploy_to_azure.yml)

## Releases

There are no official releases just now. Stay tuned.

## Setup for yourself

Follow these steps to set up and run webmud3 locally:

### Clone the Repository

Clone the repository to your local machine using the following command:

`git clone https://github.com/unitopia-de/webmud3.git`

### Install Dependencies

Navigate to the root directory of the project and install the necessary packages. This command will automatically install all required packages for both the frontend and backend:

`npm install`

### Set Environment Variables

You need to set the following environment variables to configure the backend connection. You can do this either directly in your shell before starting the backend (or the client in completion), or by creating a .env file in the root directory.

Example .env file:

```bash
HOST=0.0.0.0                                # Optional | defaults to '0.0.0.0'        | the IP the backend will listen for
PORT=5000                                   # Optional | defaults to 5000             | the PORT the backend will listen for
NAME=webmud3                                # Optional | defaults to 'webmud3'        | the name of the client
TELNET_HOST=127.0.0.1                       # Required | the IP of your MUD
TELNET_PORT=23                              # Required | the PORT of your MUD
TELNET_TLS=false                            # Optional | defaults to 'false'          | set this to true if you want a secure connection
SOCKET_TIMEOUT=900000                       # Optional | defaults to 900000 (15 min)  | timeout for any lost frontend <-> backend connection
SOCKET_ROOT=/socket.io                      # Required | URL for the socket connection. e.g. 'https://mud.example.com/socket.io'
ENVIRONMENT='development'                   # Optional | accepts values 'development' or 'production' | defaults to 'production' | Enables Debug REST Endpoint /api/info and allows for permissive CORS if set to 'development'
CORS_ALLOWED_ORIGINS='8.8.8.8,12.12.12.12' # Optional | comma separated list of origins that are allowed when ENVIRONMENT=production
```

> [!TIP]
> You can also put this file in any compiled directory, like `/backend/dist` after you run `npm run build`.

Ensure that the frontend is configured to connect to the correct backend. This can be set by editing the backendUrl in the frontend/src/environments/environment.ts file:

```ts
export const environment = {
  // .. other properties might appear here
  backendUrl: "http://localhost:5000", // Set this to your backend's IP or URL
};
```

> [!WARNING]
> This must be done at compile time. There is (currently) no way to change this setting after compilation!

### Build & Run

To build and run both the frontend and backend simultaneously, use the following command in the root directory:

`npm run start`

This command builds the frontend and integrates it into the backend, which serves the frontend during runtime.

To visit it, open your browser at `http://localhost:5000` or to be more precise: `http:<HOST>:<PORT>` where HOST and PORT are the repective [Options](#set-environment-variables) during runtime.

Alternatively, you can build and run them separately:

Build or start the frontend:

```bash
cd frontend
npm run build or npm run start
```

Build or start the backend:

```bash
cd backend
npm run build or npm run start
```

## Docker

Docker images for easy deployment will follow. Stay tuned.

## Contributions

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

You can either create an issue for whatever problem you have (dont by shy - there are no regulations on how to create such an issue - so feel free to describe your problems).

Or you can fix problems by yourself. Follow these instructions:

### Ensure your client is up and running

Follow the instructions at [Setup](#setup) and make sure you can connect to a MUD. You will have to clone this repository into you own account. We recommend you to check out the "develop" branch for easy integration since this is our default branch.

### Make your changes

We recommend you to to create a new branch out of your newly copied "develop" branch of your own repository.
Make your changes there.

### Test your changes

To speed things up, you should run `npm run test` at the root to run every unit test in the repo. This might help you to identify bugs caused by your changes (and only yours hopefully). If you want to integrate your changes to the official repository, your PR will be checked anyways so its better to do it beforehand.

### Create a PR

Create a PR targeting unitopia.de/develop if you want to integrate this changes to the official repository. A previously created issue on the unitopia repository might help you to integrate faster and avoid discussions with the staff. Your PR will be checked against automated tests and needs to be approved by one or more official members of unitopia.

## License

This project is licensed under the GPL-3.0 license - see the [LICENSE](LICENSE) file for details.

## Contact

Any troubles? Feel free to reach out:

- @mystiker Can help you with any project related questions and meta questions (git or deployments for example).
- @myonara Can help you with anything MUD related (protocols, mudlib, ..).
