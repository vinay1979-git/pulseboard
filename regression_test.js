const URL = "http://localhost:3000/api/db";

async function apiCall(action, args = {}) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...args })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "API call failed");
  }
  return res.json();
}

async function runTests() {
  console.log("\n==================================================");
  console.log("🚀 Starting PulseBoard Regression Integration Test Suite...");
  console.log("==================================================\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  let TEST_USER_ID = "demo-user-id";
  let newSession = null;
  try {
    // Test 1: Get Seed Session
    const session = await apiCall("getSessionByCode", { code: "123456" });
    assert(session !== null && session.code === "123456", "getSessionByCode fetches the seed session successfully.");

    // Dynamically resolve TEST_USER_ID from seed session creator to satisfy UUID & Foreign Key constraints
    TEST_USER_ID = session.created_by;

    // Sync profile first to ensure UUID and foreign key constraints pass
    await apiCall("syncUserProfile", { userId: TEST_USER_ID, email: "regression-test@example.com" });

    // Test 2: Get Seed Questions
    const questions = await apiCall("getQuestions", { sessionId: session.id });
    assert(questions.length >= 2, `getQuestions returns ${questions.length} questions for seed session.`);

    // Test 3: Create New Session
    newSession = await apiCall("createSession", { userId: TEST_USER_ID, title: "Automated Regression Room" });
    assert(newSession.title === "Automated Regression Room" && newSession.status === "inactive", "createSession creates a new inactive room.");

    // Test 4: Activate Session
    await apiCall("updateSessionStatus", { sessionId: newSession.id, status: "active" });
    const activatedSession = await apiCall("getSessionByCode", { code: newSession.code });
    assert(activatedSession.status === "active", "updateSessionStatus successfully activates the session room.");

    // Test 5: Add Multiple Questions to Session
    const q1 = await apiCall("createQuestion", {
      sessionId: newSession.id,
      type: "multiple_choice",
      promptText: "Test Question 1 (MC)",
      options: ["Option A", "Option B"]
    });
    const q2 = await apiCall("createQuestion", {
      sessionId: newSession.id,
      type: "word_cloud",
      promptText: "Test Question 2 (Word Cloud)",
      options: []
    });
    assert(q1.type === "multiple_choice" && q2.type === "word_cloud", "createQuestion adds multiple choice and word cloud questions successfully.");

    // Test 6: Launch Grouped Questions concurrently
    await apiCall("setQuestionsLive", { sessionId: newSession.id, questionIds: [q1.id, q2.id] });
    const freshQuestions = await apiCall("getQuestions", { sessionId: newSession.id });
    const liveQs = freshQuestions.filter(q => q.is_live);
    assert(liveQs.length === 2 && liveQs.some(q => q.id === q1.id) && liveQs.some(q => q.id === q2.id), "setQuestionsLive sets multiple questions live concurrently.");

    // Test 7: Participant Survey Engine Simulation - Initial Load
    // Participant should land on the first unvoted question (q1)
    const pId = "p-regression-voter-" + Date.now();
    
    // Check which questions are unanswered
    const liveBatch = liveQs;
    const checkVoted = async (qId) => {
      const resps = await apiCall("getResponses", { questionId: qId });
      return resps.some(r => r.participant_id === pId);
    };

    let firstUnvotedIndex = -1;
    for (let i = 0; i < liveBatch.length; i++) {
      const alreadyVoted = await checkVoted(liveBatch[i].id);
      if (!alreadyVoted) {
        firstUnvotedIndex = i;
        break;
      }
    }
    assert(firstUnvotedIndex === 0, `Initial survey load resolves to first unvoted question index (Expected: 0, Actual: ${firstUnvotedIndex}).`);

    // Test 8: Vote on Question 1 and advance
    await apiCall("submitResponse", { questionId: q1.id, participantId: pId, value: "0" });
    
    // Simulate Tab Refresh / Re-evaluating next unanswered question
    let nextUnvotedIndex = -1;
    for (let i = 0; i < liveBatch.length; i++) {
      const alreadyVoted = await checkVoted(liveBatch[i].id);
      if (!alreadyVoted) {
        nextUnvotedIndex = i;
        break;
      }
    }
    assert(nextUnvotedIndex === 1, `After voting on Q1, survey progression resolves to first unvoted question index (Expected: 1, Actual: ${nextUnvotedIndex}).`);

    // Test 9: Complete final question (Q2)
    await apiCall("submitResponse", { questionId: q2.id, participantId: pId, value: "Solid" });
    
    // Simulate final refresh check (completed status)
    let finalUnvotedIndex = -1;
    for (let i = 0; i < liveBatch.length; i++) {
      const alreadyVoted = await checkVoted(liveBatch[i].id);
      if (!alreadyVoted) {
        finalUnvotedIndex = i;
        break;
      }
    }
    assert(finalUnvotedIndex === -1, `After answering all questions, survey progression yields -1 (Expected: -1, Actual: ${finalUnvotedIndex}), indicating survey completion.`);

    // Test 10: Dynamic Reset Responses
    await apiCall("resetResponses", { questionId: q1.id });
    const resetResps = await apiCall("getResponses", { questionId: q1.id });
    assert(resetResps.length === 0, "resetResponses successfully clears responses from database.");

    // Test 11: Participant Registration
    const participantName = "Jane Doe";
    const participantEmail = "jane.doe@example.com";
    const registeredParticipant = await apiCall("registerParticipant", {
      sessionId: newSession.id,
      name: participantName,
      email: participantEmail
    });
    assert(
      registeredParticipant !== null &&
      registeredParticipant.name === participantName &&
      registeredParticipant.email === participantEmail &&
      registeredParticipant.score === 0,
      "registerParticipant successfully registers a participant with 0 initial score."
    );

    // Test 12: Get Participants List
    const participantsList = await apiCall("getParticipants", { sessionId: newSession.id });
    assert(
      participantsList.length === 1 &&
      participantsList[0].id === registeredParticipant.id,
      "getParticipants successfully retrieves the registered participant."
    );

    // Test 13: Submit Response Linked to Participant
    const submittedResponse = await apiCall("submitResponse", {
      questionId: q1.id,
      participantId: pId,
      value: "0",
      pulseParticipantId: registeredParticipant.id
    });
    assert(
      submittedResponse !== null &&
      submittedResponse.pulse_participant_id === registeredParticipant.id,
      "submitResponse successfully saves the pulse_participant_id link."
    );

    // Test 14: Score Calculation Logic
    await apiCall("calculateScores", {
      questionId: q1.id,
      correctOption: 1 // Option index 0 (+1) = Option 1
    });

    const updatedParticipantsList = await apiCall("getParticipants", { sessionId: newSession.id });
    assert(
      updatedParticipantsList.length === 1 &&
      updatedParticipantsList[0].score === 10,
      "calculateScores successfully increments the score of correct respondents by 10 points."
    );

  } catch (err) {
    console.error("💥 Test suite encountered fatal error:", err);
    failed++;
  } finally {
    console.log("🧹 Running teardown cleanup for regression test data...");
    try {
      await apiCall("cleanupTestData", { userId: TEST_USER_ID });
      console.log("🗑️ Test database successfully cleared of test-pollution sessions.");
    } catch (cleanupErr) {
      console.error("⚠️ Failed to clean up test session:", cleanupErr.message);
    }
  }

  console.log("\n=========================================");
  console.log(`📊 REGRESSION TEST RUN COMPLETE`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log("=========================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
