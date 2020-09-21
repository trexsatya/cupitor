echo "Creating build"
mkdir -p build/docker
sudo docker build . --tag cupitor-frontend:latest --file=Dockerfile --no-cache

sudo docker tag cupitor-frontend:latest trexsatya/cupitor-frontend-nuxtjs:latest

echo "Pushing to Docker Repository"
sudo docker push trexsatya/cupitor-frontend-nuxtjs:latest

