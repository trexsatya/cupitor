package com.satya

import com.satya.domain.Article
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Configuration
import org.springframework.data.mongodb.core.MongoOperations
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent

@Configuration
class TransformBeforeSaveInMongoDb extends AbstractMongoEventListener<Article> {
    @Autowired
    private MongoOperations mongoOperations;

    @Override
    public void onBeforeConvert(BeforeConvertEvent<Article> event) {
        Article article = event.getSource()
        article.setLastUpdated(new Date())
    }
}
