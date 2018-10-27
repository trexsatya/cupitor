package com.satya.spring.boot;

import com.satya.domain.Article;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.rest.core.config.RepositoryRestConfiguration;
import org.springframework.data.rest.core.event.ValidatingRepositoryEventListener;
import org.springframework.data.rest.webmvc.BaseUri;
import org.springframework.data.rest.webmvc.config.RepositoryRestConfigurerAdapter;
import org.springframework.data.rest.webmvc.config.RepositoryRestMvcConfiguration;
import org.springframework.validation.Errors;
import org.springframework.validation.Validator;
import org.springframework.validation.beanvalidation.CustomValidatorBean;

import java.net.URI;
import java.util.Date;

@Configuration
class MyRepositoryRestMvcConfiguration extends RepositoryRestConfigurerAdapter {

    @Override
    public void configureRepositoryRestConfiguration(RepositoryRestConfiguration config) {
        config.setBasePath("/api");
//      super.configureRepositoryRestConfiguration(config);
        config.setReturnBodyOnUpdate(true);
        config.setReturnBodyForPutAndPost(true);
        config.setReturnBodyOnCreate(true);
        
        config.getCorsRegistry().addMapping("/api/**")
                .allowedMethods("PUT", "DELETE", "GET", "POST")
                .allowedHeaders("Content-Type", "X-Auth")
                .exposedHeaders("Content-Type")
                .allowCredentials(false).maxAge(3600);
    }

    public void configureValidatingRepositoryEventListener(ValidatingRepositoryEventListener validatingListener) {
        Validator transformerForLastUpdated = new Validator() {
            @Override
            public boolean supports(Class<?> clazz) {
                if(Article.class.isAssignableFrom(clazz)) {
                    return true;
                }
                return false;
            }

            @Override
            public void validate(Object target, Errors errors) {
                Article article = (Article) target;
                article.setLastUpdated(new Date());
            }
        };
        validatingListener.addValidator("beforeSave", transformerForLastUpdated);
    }
}