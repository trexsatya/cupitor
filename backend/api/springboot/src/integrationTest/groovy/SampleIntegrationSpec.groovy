import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.ContextConfiguration
import spock.lang.Specification

/**
 * Created by Anoop Singh on 12/16/2016.
 */

@ContextConfiguration(classes = [IntegrationContextConfigs.class])
class SampleIntegrationSpec extends Specification {

    @Autowired
    RestClientForIntegrationTest restClient

    @Autowired
    Object restClientForIntegrationTest

    void shouldBeTrue(){
        given: "given"
        when: "when"
        then:
            restClient != null
            restClientForIntegrationTest != null
    }
}
