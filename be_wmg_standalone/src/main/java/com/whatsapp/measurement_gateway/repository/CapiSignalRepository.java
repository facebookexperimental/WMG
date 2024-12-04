package com.whatsapp.measurement_gateway.repository;

import com.whatsapp.measurement_gateway.data.CapiSignal;
import java.util.List;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CapiSignalRepository
    extends PagingAndSortingRepository<CapiSignal, Integer>, CrudRepository<CapiSignal, Integer> {

  List<CapiSignal> findByBusinessPhoneNumberIdAndConsumerPhoneNumberOrderByEventTimestampDesc(
      String businessPhoneNumberId, String consumerPhoneNumber);
}
