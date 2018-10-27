# cupitor

Deploy and Run:

Using Docker and Docker-Compose:
  Install Docker
  
  Install Docker Compose
  sudo curl -L "https://github.com/docker/compose/releases/download/1.22.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  
  Compose is a nice way to define and connect services in a single file; To make communcation happen, environment variables are used e.g. in this project "Which mongo db URL will cupitor-api service will call for database connection?" is defined by environment variable.
  API_URL is passed on to frontend container. docker-compose file itself uses some environment variables.

sudo docker-compose pull
sudo <env variables> docker-compose up -d

#To shutdown
sudo docker-compose down


After making changes to the projects rebuild docker images tag them and then push them to DockerHub repository.

Example:<br>
docker tag cupitor-backend-springboot[:tag] trexsatya/cupitor-backend-springboot
docker push trexsatya/cupitor-backend-springboot:latest

