
package com.satya.dao

import org.springframework.data.mongodb.repository.MongoRepository;
import com.satya.domain.Article
import org.springframework.data.mongodb.repository.*

interface ArticleRepo extends MongoRepository<Article,Long> {

    @Query('{ "subject" : { $regex : ?0 }, "tags" : { $in : ?1 } }')
    List<Article> findBySubjectAndTags(String subject, List<String> tags)

    List<Article> findBySubjectLike(String subject)

    @Query('{ $or: [ { "name": { $regex: ?0 , $options: "i" } }, { "summary": { $regex: ?0 , $options: "i" } }] }')
    List<Article> searchArticles(String text)

}

