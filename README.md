# What are we creating here
A  <a href="https://en.wikipedia.org/wiki/Multitier_architecture">multi-tiered</a> web based application which has a front-end (web pages which users can see on the internet), a REST-based backend API, and a DB MongoDB based backend storage.
We will create different implementations of Frontend and backend API. Currently VueJS (Vue2) implementation is available for frontend and Groovy/Java based implementation for backend.

Each of the module (backend and frontend) will be deployable using Docker. 
Docker Compose file is provided to start the whole application (frontend, backend and DB) at once.

Functionality of the application: Currently this application is a simple website which will show articles. Articles are stored in MongoDB. Frontend fetches articles using REST API.

# Deploy and Run:

## Using Docker and Docker-Compose:
  Install Docker:
  
    For a debian system easiest way is to download .deb package from https://download.docker.com/linux/ubuntu/dists/<linux-name>/pool/stable/amd64/<version>.deb
  
   <code>dpkg -i docker-ce..deb </code>
  
   <code>apt-get install -y libltdl7 </code> (<i>Required only if lib error occurs</i>)
  
  Install Docker Compose:
  
  <code> sudo curl -L "https://github.com/docker/compose/releases/download/1.22.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose </code>
  
  <code> sudo chmod +x /usr/local/bin/docker-compose </code>
  
  Compose is a nice way to define and connect services in a single file; To make communcation happen, environment variables are used e.g. in this project "Which mongo db URL will cupitor-api service will call for database connection?" is defined by environment variable.
  API_URL is passed on to frontend container. docker-compose file itself uses some environment variables.

<code> sudo docker-compose pull </code>
<code> sudo <env variables> docker-compose up -d </code>

#To shutdown <br>
<code> sudo docker-compose down </code>


After making changes to the projects rebuild docker images tag them and then push them to DockerHub repository.

Example:<br>
<code> docker tag cupitor-backend-springboot[:tag] trexsatya/cupitor-backend-springboot </code>

<code> docker push trexsatya/cupitor-backend-springboot:latest </code>

<img src="https://docs.microsoft.com/en-us/dotnet/standard/microservices-architecture/docker-application-development-process/media/image20.png">
