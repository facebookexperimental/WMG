package com.whatsapp.measurement_gateway.repository;

import com.whatsapp.measurement_gateway.data.KeywordMapping;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KeywordRepository extends CrudRepository<KeywordMapping, Integer> {}
