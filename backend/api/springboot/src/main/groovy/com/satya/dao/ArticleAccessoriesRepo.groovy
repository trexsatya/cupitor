package com.satya.dao

import com.satya.domain.Article
import com.satya.domain.ArticleAccessories
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

/**
 * Created by Anoop Singh on 3/25/2017.
 */
@RepositoryRestResource(collectionResourceRel = "articleAccessories", path = "articleAccessories")
interface ArticleAccessoriesRepo extends MongoRepository<ArticleAccessories,String> {

}
