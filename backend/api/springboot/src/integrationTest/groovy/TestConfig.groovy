import com.mongodb.MongoClient
import com.satya.domain.Article
import cz.jirutka.spring.embedmongo.EmbeddedMongoFactoryBean
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.context.annotation.Profile
import org.springframework.core.env.Environment
import org.springframework.data.mongodb.core.MongoTemplate

@Configuration
@Profile("test")
class TestConfig {
    @Autowired
    private Environment env;

    private static final String MONGO_DB_URL = "localhost";
    private static final String MONGO_DB_NAME = "embeded_db";

    @Bean
    @Primary
    public MongoTemplate mongoTemplate() throws IOException {
        EmbeddedMongoFactoryBean mongo = new EmbeddedMongoFactoryBean();
        mongo.setBindIp(MONGO_DB_URL)
        MongoClient mongoClient = mongo.getObject()
        MongoTemplate mongoTemplate = new MongoTemplate(mongoClient, MONGO_DB_NAME)

        return mongoTemplate
    }
}