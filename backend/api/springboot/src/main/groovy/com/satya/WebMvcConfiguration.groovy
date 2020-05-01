package com.satya;

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter;

@Configuration
class WebMvcConfiguration extends WebMvcConfigurerAdapter {

//    @Override
//    void addViewControllers(ViewControllerRegistry registry) {
//        ["/articles/**", "/article/**", "/technology", "/debates", "/tools/**"].each {path->
//            registry.addViewController(path).setViewName("forward:/")
//        }
//    }

    @Override
    void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins("*").allowedHeaders("*").allowedMethods("*")
        registry.addMapping("/**").allowedOrigins("*").allowedHeaders("*").allowedMethods("*")
    }
}
