package com.satya;

import com.mongodb.MongoClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;

@Configuration
@Profile(["!integration"]) //!integration  set by SPRING_PROFILES_ACTIVE env var or other way
public class SimpleMongoConfig {

    @Value("\${spring.data.mongodb.host}")
    String mongoUrl

    @Value("\${spring.data.mongodb.database}")
    String dbName

    @Bean
    public MongoClient mongo() {
        return new MongoClient(mongoUrl)
    }

    @Bean
    public MongoTemplate mongoTemplate() throws Exception {
        return new MongoTemplate(mongo(), dbName);
    }
}