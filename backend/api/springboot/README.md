SpringBoot API 

Run on command-line:

    gradle tasks 
    gradle clean dockerBuild  
  (This will create a fat JAR file containing Application, then create a docker image that will contain the .class files) <br>

    docker tag cupitor-backend-springboot:1.0-SNAPSHOT trexsatya/cupitor-backend-springboot:latest 
    docker push trexsatya/cupitor-backend-springboot:latest    

  