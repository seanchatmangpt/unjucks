Feature: Explore Personas
  As a marketplace user
  I want to explore KPacks through different persona views
  So that I can discover relevant content based on my role and use case

  Background:
    Given the marketplace has persona-based organization enabled
    And multiple personas are configured with specific content curation
    And I have access to the marketplace

  @smoke @persona-views
  Scenario: Browse KPacks through Developer persona
    Given I select the "Developer" persona
    When I browse the marketplace
    Then I should see KPacks curated for developers including:
      | category           | examples                    |
      | frameworks         | react-components, vue-utils |
      | testing-tools      | jest-extensions, cypress-helpers |
      | development-utils  | code-generators, linters    |
      | api-integrations   | rest-clients, graphql-tools |
    And the content should be filtered for technical complexity
    And code samples should be prominently displayed

  @persona-views @data-scientist
  Scenario: Explore through Data Scientist persona
    Given I select the "Data Scientist" persona
    When I explore the marketplace
    Then I should see specialized content including:
      | category              | focus_areas                    |
      | machine-learning      | model-training, evaluation     |
      | data-processing       | etl-pipelines, data-cleaning   |
      | visualization         | charts, dashboards, reports    |
      | statistical-analysis  | hypothesis-testing, regression |
    And mathematical notation should be rendered properly
    And dataset compatibility should be highlighted

  @persona-views @business-analyst
  Scenario: Navigate as Business Analyst persona
    Given I select the "Business Analyst" persona
    When I navigate the marketplace
    Then I should see business-focused KPacks such as:
      | type                  | description                |
      | reporting-tools       | executive dashboards       |
      | process-automation    | workflow optimization      |
      | market-analysis       | competitive intelligence   |
      | financial-modeling    | forecasting, budgeting     |
    And technical details should be abstracted
    And business value propositions should be emphasized

  @persona-views @devops-engineer
  Scenario: View marketplace as DevOps Engineer
    Given I select the "DevOps Engineer" persona
    When I view available KPacks
    Then I should see infrastructure and deployment focused content:
      | category              | tools                          |
      | infrastructure        | terraform-modules, k8s-configs |
      | monitoring           | prometheus-rules, grafana-dash |
      | deployment           | ci-cd-pipelines, docker-images |
      | security             | compliance-checks, scanners    |
    And operational metrics should be displayed
    And compatibility with cloud platforms should be indicated

  @persona-switching @dynamic-views
  Scenario: Switch between different personas dynamically
    Given I start browsing as a "Developer"
    And I switch to "Data Scientist" persona
    When I view the same KPack from both perspectives
    Then the KPack details should adapt to show relevant information:
      | persona_view    | emphasized_content                    |
      | developer       | code_examples, api_documentation      |
      | data_scientist  | algorithm_details, performance_metrics |
    And the interface should update smoothly
    And my browsing context should be preserved

  @personalization @learning-preferences
  Scenario: Personalized recommendations based on persona
    Given I have been using the "Machine Learning Engineer" persona
    And my interaction history shows interest in "computer vision"
    When I visit the marketplace homepage
    Then I should see personalized recommendations including:
      | recommendation_type | examples                        |
      | similar_interests   | image-processing, object-detection |
      | trending_in_field   | neural-networks, deep-learning    |
      | complementary_tools | data-augmentation, model-serving  |
    And recommendations should be updated based on recent activity

  @persona-onboarding @guided-experience
  Scenario: Guided onboarding for new persona users
    Given I am a new user selecting "Product Manager" persona
    When I first access the marketplace
    Then I should receive a guided tour showing:
      | tour_element        | description                      |
      | persona_benefits    | how PM view differs from others  |
      | key_categories      | product-analytics, user-research |
      | success_metrics     | roi-calculators, kpi-dashboards  |
      | community_resources | pm-specific forums and guides    |
    And the tour should be interactive and skippable

  @accessibility @persona-adaptation
  Scenario: Accessible persona views for different needs
    Given personas can be adapted for accessibility requirements
    When I enable accessibility features for "Technical Writer" persona
    Then the interface should adapt to support:
      | accessibility_feature | implementation                |
      | screen_reader        | semantic markup, alt-texts     |
      | high_contrast        | enhanced color schemes         |
      | keyboard_navigation  | tabindex, keyboard shortcuts   |
      | content_simplification | plain language summaries    |
    And persona-specific content should remain fully accessible

  @multi-role @hybrid-personas
  Scenario: Create hybrid persona for multi-role users
    Given I work as both "Developer" and "Project Manager"
    When I create a custom hybrid persona
    Then I should be able to combine views showing:
      | role_aspect      | content_type                     |
      | developer        | technical_specifications, code   |
      | project_manager  | timelines, resource_requirements |
    And the hybrid view should balance both perspectives
    And I should be able to adjust the balance between roles

  @analytics @persona-insights
  Scenario: Track persona-specific engagement analytics
    Given analytics are enabled for persona views
    When users interact with different persona interfaces
    Then the system should track:
      | metric_type           | data_points                    |
      | persona_popularity    | usage_frequency, session_time  |
      | content_effectiveness | click_rates, conversion_rates  |
      | search_patterns      | queries, result_interactions   |
      | persona_switching    | frequency, triggers, outcomes  |
    And insights should inform persona optimization

  @content-curation @editorial
  Scenario: Editorial curation for persona-specific content
    Given editorial teams curate content for different personas
    When new KPacks are published
    Then they should be evaluated for persona relevance:
      | evaluation_criteria    | persona_fit_scoring         |
      | technical_complexity   | beginner_intermediate_advanced |
      | use_case_alignment    | primary_secondary_tertiary     |
      | role_applicability    | direct_indirect_tangential     |
    And curated collections should be maintained for each persona
    And featured content should rotate based on persona engagement

  @feedback @persona-improvement
  Scenario: Collect feedback for persona view improvements
    Given users can provide feedback on persona experiences
    When I use the "Security Engineer" persona view
    Then I should have options to:
      | feedback_type        | mechanism                  |
      | content_relevance    | thumbs_up_down_ratings     |
      | missing_categories   | suggestion_text_box        |
      | interface_usability  | quick_survey_popups        |
      | persona_accuracy     | role_alignment_questions   |
    And feedback should be used to continuously improve persona views