import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 *
 * Created by Anoop Singh on 7/22/2017.
 */
@Configuration
class IntegrationContextConfigs {

    @Bean
    RestClientForIntegrationTest restClientForIntegrationTest(){
        return new RestClientForIntegrationTest()
    }
}
