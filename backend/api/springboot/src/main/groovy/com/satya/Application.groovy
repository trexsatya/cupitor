package com.satya

import com.satya.services.CounterService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.satya.dao.*
import org.apache.logging.log4j.*
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.event.ContextRefreshedEvent
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.CorsFilter

import java.util.concurrent.Executors;

@SpringBootApplication(scanBasePackages = ["com.satya"])
//@EnableAutoConfiguration
@EnableMongoRepositories(basePackages = ["com.satya.dao"])
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties
class Application implements CommandLineRunner {

	private static final Logger logger = LogManager.getLogger(Application.class);

	@Value("\${spring.data.mongodb.uri:}")
	String mongoUrl

	/** To register a filter for handling CORS for Spring data rest beans **/
	@Bean
	FilterRegistrationBean corsFilter() {
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowCredentials(true);
		config.addAllowedOrigin("*");
		config.addAllowedHeader("*");
		config.addAllowedMethod("OPTIONS");
		config.addAllowedMethod("HEAD");
		config.addAllowedMethod("GET");
		config.addAllowedMethod("PUT");
		config.addAllowedMethod("POST");
		config.addAllowedMethod("DELETE");
		config.addAllowedMethod("PATCH");
		source.registerCorsConfiguration("/**", config);
		// return new CorsFilter(source);
		final FilterRegistrationBean bean = new FilterRegistrationBean(new CorsFilter(source));
		bean.setOrder(0);
		return bean;
	}

	@Autowired
	private ArticleRepo repository;

	@Autowired
	private CounterService counter;

	static void main(String[] args) {
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(Application.class)
				.properties("spring.config.name:application",
				"spring.config.location:classpath:/external/properties/")
				.build().run(args)

	}

//	@Override
	void run(String... args) throws Exception {
		println "run(..)"
	}

	@Scheduled(fixedDelay = 3600000L) //per hour
	void cronJob() {
		println "Running cron to hit websites."
	}

	@Bean
	taskExecutor() {
		Executors.newScheduledThreadPool(1);
	}

	@Bean
	public ThreadPoolTaskScheduler threadPoolTaskScheduler(){
		ThreadPoolTaskScheduler threadPoolTaskScheduler= new ThreadPoolTaskScheduler()

		threadPoolTaskScheduler.setPoolSize(5)
		threadPoolTaskScheduler.setThreadNamePrefix("ThreadPoolTaskScheduler")

		return threadPoolTaskScheduler
	}

	@org.springframework.context.event.EventListener
	void afterSpringLoaded(ContextRefreshedEvent event) {
		println "Mongo URL: $mongoUrl"
	}

}
