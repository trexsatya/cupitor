# What are we creating here
A  <a href="https://en.wikipedia.org/wiki/Multitier_architecture">multi-tiered</a> web based application which has a front-end (web pages which users can see on the internet), a REST-based backend API, and a DB MongoDB based backend storage.
We will create different implementations of Frontend and backend API. Currently VueJS (Vue2) implementation is available for frontend and Groovy/Java based implementation for backend.

Each of the module (backend and frontend) will be deployable using Docker. 
Docker Compose file is provided to start the whole application (frontend, backend and DB) at once.

Functionality of the application: Currently this application is a simple website which will show articles. Articles are stored in MongoDB. Frontend fetches articles using REST API.

# Deploy and Run:

## Using Docker and Docker-Compose:
  Install Docker:
  
    For a debian system easiest way is to download .deb package from https://download.docker.com/linux/ubuntu/dists/<linux-name>/pool/stable/amd64/<version>.debian
  
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


<hr>

Take dump of the mongodb on server and copy it to docker instance after starting up the services
mongodump --forceTableScan -d cupitor-db -o dump #inside the directory you want to take dump in

docker cp  dump/cupitor-db cupitor-frontend:/var/www

Verify by looking into docker:
docker exec <containerId> bash #get containerId using docker ps command
ls /var/ww/cupitor-db

for i in $(ls /var/www/cupitor-db); do echo "http://satyendra.online/cupitor-db/$i"; done; 

http://satyendra.online/cupitor-db/article.bson
http://satyendra.online/cupitor-db/article.metadata.json
http://satyendra.online/cupitor-db/counter.bson
http://satyendra.online/cupitor-db/counter.metadata.json
http://satyendra.online/cupitor-db/notepadData.bson
http://satyendra.online/cupitor-db/notepadData.metadata.json

To Restore MongoDB data:
--------------------------
docker cp  dump/cupitor-db mongodb-server:/tmp
docker exec -it [containerId of mongodb-server] bash
mongorestore -d cupitor-db dump

Configure GCloud
Create project and instance

gcloud beta compute --project "forward-theorem-261407" ssh --zone "asia-south1-c" "cupitor-vm"

gcloud compute scp --recurse [local_folder] cupitor-vm:/tmp


Using GCloud Shell to deploy manually
-------------------------------------
 Install gcloud
 > gcloud auth login
 > gcloud projects list
 > gcloud config set project ${project_id}
 > gcloud compute instances list
 > gcloud compute ssh ${username}@${instance_name}

 Run Docker commands
 
 
Docker Utility Commands:
To Remove unused images: `docker image prune --all`

To remove all images: `docker rmi $(docker images | awk '{print $3}')`