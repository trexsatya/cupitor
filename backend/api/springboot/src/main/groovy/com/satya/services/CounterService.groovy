package com.satya.services

import com.satya.domain.Counter
import org.springframework.data.mongodb.core.*
import org.springframework.data.mongodb.core.query.*
import static org.springframework.data.mongodb.core.query.Query.*;
import static org.springframework.data.mongodb.core.query.Criteria.*;
import static org.springframework.data.mongodb.core.FindAndModifyOptions.*;
import org.springframework.beans.factory.annotation.*
import org.springframework.stereotype.*

@Service
public class CounterService {
    @Autowired private MongoOperations mongo;

    public long getNextSequence(String collectionName) {
        Counter counter = mongo.findAndModify(
                query(where("_id").is(collectionName)),
                new Update().inc("seq", 1),
                options().returnNew(true),
                Counter.class);

        if(counter == null){
            def cntr = new Counter()
            cntr.id = collectionName
            cntr.seq = 1L
            mongo.insert( cntr)
            return 1L
        }
        return counter.seq;
    }
}
