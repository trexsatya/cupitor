package com.satya.interception

import com.satya.domain.Article
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent
import org.springframework.stereotype.Component

@Component
class MongoDocumentModifier extends AbstractMongoEventListener<Article>{

    @Override
    void onBeforeSave(BeforeSaveEvent<Article> event) {
        Article article = event.getSource()
        article.setLastUpdated(new Date())
        super.onBeforeSave(event)
    }
}
