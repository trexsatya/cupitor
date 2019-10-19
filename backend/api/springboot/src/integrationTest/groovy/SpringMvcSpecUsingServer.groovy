import com.satya.Application
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.boot.web.server.LocalServerPort
import org.springframework.web.context.WebApplicationContext
import spock.lang.Specification

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, classes = [Application.class])
class SpringMvcSpecUsingServer extends Specification {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    WebApplicationContext context

    def "should boot up without errors"() {

        def template = TestHttpClient.springRestTemplate()
        def out = template.getForEntity("http://localhost:" + port +"/api/articles/java", String.class)

        println "satya $out"

        expect: "web application context exists"
        context != null
    }

    def "should search without errors"(){
        def template = TestHttpClient.springRestTemplate()
        def out = template.getForEntity("http://localhost:" + port +"/api/search", String.class)

        println out

        expect:
        context != null
    }
}
