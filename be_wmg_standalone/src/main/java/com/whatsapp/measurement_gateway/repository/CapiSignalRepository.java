/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
