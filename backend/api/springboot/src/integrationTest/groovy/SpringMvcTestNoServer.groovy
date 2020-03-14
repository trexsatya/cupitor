import com.fasterxml.jackson.databind.ObjectMapper
import com.mongodb.BasicDBObjectBuilder;
import com.mongodb.DBObject
import com.mongodb.client.MongoClients;
import com.satya.Application
import com.satya.domain.Article
import com.satya.services.CounterService;
import org.assertj.core.api.Assertions
import org.hamcrest.CoreMatchers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.ImportAutoConfiguration
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration
import org.springframework.boot.test.autoconfigure.core.AutoConfigureCache
import org.springframework.boot.test.autoconfigure.data.mongo.AutoConfigureDataMongo;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTypeExcludeFilter
import org.springframework.boot.test.autoconfigure.filter.TypeExcludeFilters
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.web.servlet.MockMvc

import static org.hamcrest.CoreMatchers.containsString
import static org.hamcrest.CoreMatchers.not
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ContextConfiguration(classes = [Application.class, TestConfig.class])
@ActiveProfiles(profiles = "test")
@TestPropertySource(properties = ["users=a:a:USER-ADMIN" ])
class SpringMvcTestNoServer {

    @Autowired
    private MockMvc mockMvc

    @Autowired MongoTemplate mongoTemplate

    @Test
    public void "should fetch articles without errors"(){
        //Given that the DB has the article present
        mongoTemplate.save(new Article(subject: "java", id: 1, name: "Hello World"))

        //When
        this.mockMvc.perform(get("/api/articles/java")).andDo(print())

        //Then
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Hello World")))
    }

    @Test
    public void "should not be able to edit article if not authorized"() {
        //Given: that the article exists
        mongoTemplate.save(new Article(subject: "java", id: 1, name: "Hello World"))

        //And:
        this.mockMvc.perform(
                post("/api/article").content("{ \"id\": 1 }")
                        .contentType(MediaType.APPLICATION_JSON_UTF8)
        ).andDo(print())

        //Then:
                .andExpect(status().is(401))
    }

    @Test
    public void  "should be able to edit article if authorized"(){
        this.mockMvc.perform(
                post("/api/article").content("{\"id\": 1}")
                        .contentType(MediaType.APPLICATION_JSON_UTF8).header("X-Auth", "a-a")
        )
                .andDo(print()).andExpect(status().is(200))

    }

    @Test
    public void  "should not be able to access notepad without auth"(){
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

    @Test
    public void  "should automatically insert last updated"(){
        Article article = new Article()
        article.setId(1)
        article.setName("Test")

        this.mockMvc.perform(
                post("/api/article")
                        .contentType(MediaType.APPLICATION_JSON_UTF8).header("X-Auth", "a-a")
                        .content(objectMapper.writeValueAsString(article))
        ).andDo(print())

        //Then:
                .andExpect(jsonPath("\$.lastUpdated", CoreMatchers.is(not(null))))

    }
}