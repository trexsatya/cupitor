package com.satya.dao

import com.satya.domain.Article
import com.satya.domain.GenericData
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

/**
 * Created by Anoop Singh on 3/25/2017.
 */
@RepositoryRestResource(collectionResourceRel = "genericData", path = "generic-data")
interface GenericDataRepo extends MongoRepository<GenericData,String> {

}
