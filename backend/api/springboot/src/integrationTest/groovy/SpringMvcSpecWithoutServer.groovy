import com.fasterxml.jackson.databind.ObjectMapper
import com.mongodb.Mongo
import com.mongodb.MongoClient
import com.satya.dao.ArticleRepo
import com.satya.domain.Article
import cz.jirutka.spring.embedmongo.EmbeddedMongoFactoryBean
import org.hamcrest.CoreMatchers
import org.mockito.Mockito
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.data.mapping.context.MappingContext
import org.springframework.data.mongodb.config.AbstractMongoConfiguration
import org.springframework.data.mongodb.core.MongoOperations
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.convert.MongoConverter
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty
import org.springframework.http.MediaType
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.ResultMatcher
import spock.lang.AutoCleanup
import spock.lang.Shared

import static org.hamcrest.CoreMatchers.not
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.satya.spring.boot.Application
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

@SpringBootTest
@AutoConfigureMockMvc
@ContextConfiguration(classes = [Application.class, TestConfig.class])
//@ActiveProfiles(profiles = "prod")
@TestPropertySource(properties = ["users=a:a:USER-ADMIN" ])
class SpringMvcSpecWithoutServer extends Specification{

    MongoConverter converter = Mockito.mock(MongoConverter.class)

    //@BeforeClass
    def setupSpec(){

    }

    @Autowired
    private MockMvc mockMvc

    def "should fetch articles without errors"() {
        this.mockMvc.perform(get("/api/articles/java")).andDo(print()).andExpect(status().isOk())
//                .andExpect(content().string(containsString("Hello World")))

        expect: ""
        true
    }

    def "should not be able to edit article if not authorized"(){

        this.mockMvc.perform(
                    post("/api/article").content("{ \"id\": 1 }")
                    .contentType(MediaType.APPLICATION_JSON_UTF8)
                )
                .andDo(print()).andExpect(status().is(401))

        expect:
        true
    }

    def "should be able to edit article if authorized"(){
        this.mockMvc.perform(
                post("/api/article").content("{\"id\": 1}")
                        .contentType(MediaType.APPLICATION_JSON_UTF8).header("X-Auth", "a-a")
        )
                .andDo(print()).andExpect(status().is(200))

        expect:
        true
    }


    def "should not be able to access notepad without auth"(){
         this.mockMvc.perform(
                    get("/api/notepadData")
                            .contentType(MediaType.APPLICATION_JSON_UTF8)
                            //.header("X-Auth", "a-a")
            )
                .andDo(print()).andExpect(status().is(401))

        expect:
            true
    }

    ObjectMapper objectMapper = new ObjectMapper()

    def "should automatically insert last updated"(){
        Article article = new Article()
        article.setId(1)
        article.setName("Test")

        this.mockMvc.perform(
                post("/api/article")
                        .contentType(MediaType.APPLICATION_JSON_UTF8).header("X-Auth", "a-a")
                .content(objectMapper.writeValueAsString(article))
        ).andDo(print()).andExpect(jsonPath("\$.lastUpdated", CoreMatchers.is(not(null))))

        expect: true
    }
}

@Configuration
class TestConfig{
    @Autowired
    private Environment env;

    private static final String MONGO_DB_URL = "localhost";
    private static final String MONGO_DB_NAME = "embeded_db";
    @Bean
    public MongoTemplate mongoTemplate() throws IOException {
        EmbeddedMongoFactoryBean mongo = new EmbeddedMongoFactoryBean();
        mongo.setBindIp(MONGO_DB_URL);
        MongoClient mongoClient = mongo.getObject();
        MongoTemplate mongoTemplate = new MongoTemplate(mongoClient, MONGO_DB_NAME);

        mongoTemplate.save(new Article(subject: "java", id: 1))
        return mongoTemplate
    }
}