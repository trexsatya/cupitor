import com.satya.spring.boot.Application
import org.springframework.test.context.ContextConfiguration
import spock.lang.Specification

/**
 * Created by Anoop Singh on 12/17/2016.
 */
@ContextConfiguration(classes = [Application.class])
class SampleSpockSpec extends Specification{


    def "should be true"(){
        when: "when"

        then: "then"
            true
    }
}
