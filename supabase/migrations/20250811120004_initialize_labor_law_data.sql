-- =====================================================
-- Initialize Saudi Labor Law Knowledge Base
-- Complete setup with actual Saudi labor law articles
-- =====================================================

-- First, initialize labor law data
SELECT initialize_labor_law_data();

-- Insert comprehensive labor law articles
-- Note: In production, this would be a much larger dataset

-- Wage and Salary Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'WAGES'),
    'المادة 89',
    'مفهوم الأجر',
    'Definition of Wage',
    'الأجر هو ما يتقاضاه العامل لقاء عمله، مهما كان نوعه أو طريقة أدائه، ويشمل العمولة والنسب المئوية ومزايا الأداء والعلاوات والبدلات التي تكون مستحقة وفق شروط عقد العمل، والمزايا العينية والمصاريف التي يتحملها صاحب العمل للعامل أو التي يدفعها له نيابة عنه.',
    'Wage is what the worker receives for their work, regardless of its type or method of performance, including commission, percentages, performance benefits, allowances and benefits due according to employment contract terms, in-kind benefits and expenses borne by the employer for the worker or paid on their behalf.',
    'الأجر يشمل الراتب الأساسي والعمولة والبدلات والمزايا العينية',
    'Wage includes basic salary, commission, allowances and in-kind benefits',
    ARRAY['أجر', 'راتب', 'عمولة', 'بدلات', 'مزايا'],
    ARRAY['wage', 'salary', 'commission', 'allowances', 'benefits'],
    'نظام العمل السعودي - الباب السابع - المادة 89',
    '2005-04-23'
),
(
    (SELECT id FROM labor_law_categories WHERE code = 'WAGES'),
    'المادة 95',
    'الحد الأدنى للأجور',
    'Minimum Wage',
    'يحدد مجلس الوزراء الحد الأدنى للأجور بناءً على توصية من الوزير، ويجب ألا يقل أجر العامل عن هذا الحد. ولا يجوز الاتفاق على أجر يقل عن الحد الأدنى المقرر.',
    'The Council of Ministers determines the minimum wage based on a recommendation from the Minister, and the worker''s wage must not be less than this limit. It is not permissible to agree on a wage less than the prescribed minimum.',
    'يحدد مجلس الوزراء الحد الأدنى للأجور ولا يجوز النزول عنه',
    'Council of Ministers sets minimum wage and it cannot be reduced',
    ARRAY['حد أدنى', 'أجور', 'مجلس الوزراء'],
    ARRAY['minimum wage', 'wages', 'council of ministers'],
    'نظام العمل السعودي - الباب السابع - المادة 95',
    '2005-04-23'
);

-- Employment Termination Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'TERMINATION'),
    'المادة 74',
    'إنهاء عقد العمل من جانب واحد',
    'Unilateral Termination of Employment Contract',
    'لا يجوز لأي من طرفي عقد العمل إنهاؤه في عقود العمل المحددة المدة قبل انتهاء مدته إلا في الحالات المنصوص عليها في هذا النظام، وإذا كان الإنهاء من جانب صاحب العمل تعين عليه أن يدفع للعامل تعويضاً يوازي أجره عن المدة الباقية من العقد.',
    'Neither party to the employment contract may terminate fixed-term employment contracts before the end of their term except in cases stipulated in this system. If termination is by the employer, they must pay the worker compensation equal to their wage for the remaining contract period.',
    'لا يجوز إنهاء عقد العمل المحدد المدة إلا في حالات معينة مع دفع تعويض',
    'Fixed-term contracts cannot be terminated except in specific cases with compensation',
    ARRAY['إنهاء عقد', 'تعويض', 'عقد محدد المدة'],
    ARRAY['contract termination', 'compensation', 'fixed-term contract'],
    'نظام العمل السعودي - الباب السادس - المادة 74',
    '2005-04-23'
),
(
    (SELECT id FROM labor_law_categories WHERE code = 'TERMINATION'),
    'المادة 77',
    'أسباب فصل العامل دون مكافأة أو إشعار',
    'Reasons for Dismissing Worker Without Gratuity or Notice',
    'يجوز لصاحب العمل فصل العامل في أي وقت دون مكافأة أو إشعار في الحالات التالية: إذا اعتدى على صاحب العمل أو المدير المسؤول، أو إذا لم يؤد الالتزامات الجوهرية المترتبة على عقد العمل، أو إذا ثبت اتباعه سلوكاً سيئاً أو ارتكابه عملاً مخلاً بالشرف أو الأمانة.',
    'The employer may dismiss the worker at any time without gratuity or notice in the following cases: if they assault the employer or responsible manager, if they fail to perform essential obligations under the employment contract, or if proven to follow bad conduct or commit acts contrary to honor or trust.',
    'يجوز فصل العامل دون مكافأة في حالات الاعتداء أو إهمال الواجبات أو سوء السلوك',
    'Worker may be dismissed without gratuity for assault, duty neglect, or misconduct',
    ARRAY['فصل', 'سوء سلوك', 'اعتداء', 'إهمال واجبات'],
    ARRAY['dismissal', 'misconduct', 'assault', 'duty neglect'],
    'نظام العمل السعودي - الباب السادس - المادة 77',
    '2005-04-23'
);

-- Leave and Holiday Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'LEAVE'),
    'المادة 112',
    'إجازة الأمومة',
    'Maternity Leave',
    'للعاملة الحق في إجازة وضع مدتها عشرة أسابيع بأجر كامل، موزعة على فترة ما قبل الوضع وما بعده، على ألا تقل فترة ما بعد الوضع عن ستة أسابيع. ولا يجوز تشغيل العاملة خلال الأسابيع الستة التالية للوضع.',
    'A working woman has the right to maternity leave of ten weeks with full pay, distributed over the pre and post-delivery period, provided that the post-delivery period is not less than six weeks. The working woman may not be employed during the six weeks following delivery.',
    'إجازة الأمومة 10 أسابيع بأجر كامل مع منع التشغيل 6 أسابيع بعد الوضع',
    'Maternity leave: 10 weeks full pay with 6-week post-delivery work prohibition',
    ARRAY['إجازة أمومة', 'أجر كامل', 'وضع', 'عاملة'],
    ARRAY['maternity leave', 'full pay', 'delivery', 'working woman'],
    'نظام العمل السعودي - الباب الثامن - المادة 112',
    '2005-04-23'
),
(
    (SELECT id FROM labor_law_categories WHERE code = 'LEAVE'),
    'المادة 113',
    'إجازة مرافقة المريض',
    'Medical Accompaniment Leave',
    'للعامل الحق في إجازة بدون أجر لمرافقة زوجه أو أحد أطفاله أو والديه للعلاج خارج مكان الإقامة داخل المملكة أو خارجها، بناءً على تقرير من طبيب مختص تعتمده الجهات الصحية المختصة، وذلك وفقاً للضوابط التي تحددها اللائحة التنفيذية.',
    'The worker has the right to unpaid leave to accompany their spouse, child, or parents for treatment outside the place of residence within the Kingdom or abroad, based on a report from a specialist doctor approved by competent health authorities, according to regulations set by executive bylaws.',
    'إجازة بدون أجر لمرافقة أفراد الأسرة للعلاج داخل أو خارج المملكة',
    'Unpaid leave to accompany family members for treatment inside or outside Kingdom',
    ARRAY['إجازة مرافقة', 'علاج', 'بدون أجر', 'أسرة'],
    ARRAY['accompaniment leave', 'treatment', 'unpaid', 'family'],
    'نظام العمل السعودي - الباب الثامن - المادة 113',
    '2005-04-23'
);

-- Working Hours Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'HOURS'),
    'المادة 99',
    'فترات الراحة',
    'Rest Periods',
    'لا يجوز تشغيل العامل أكثر من خمس ساعات متواصلة دون فترة للراحة والصلاة والطعام لا تقل عن نصف ساعة. ولا يجوز أن يبقى العامل في مكان العمل أكثر من اثنتي عشرة ساعة في اليوم الواحد.',
    'A worker may not be employed for more than five consecutive hours without a rest period for prayer and food of not less than half an hour. The worker may not remain at the workplace for more than twelve hours in one day.',
    'راحة نصف ساعة بعد 5 ساعات عمل متواصلة وحد أقصى 12 ساعة بالمكان',
    'Half-hour rest after 5 consecutive work hours, maximum 12 hours at workplace',
    ARRAY['فترة راحة', 'ساعات متواصلة', 'صلاة', 'طعام'],
    ARRAY['rest period', 'consecutive hours', 'prayer', 'food'],
    'نظام العمل السعودي - الباب السابع - المادة 99',
    '2005-04-23'
),
(
    (SELECT id FROM labor_law_categories WHERE code = 'HOURS'),
    'المادة 106',
    'العمل الإضافي',
    'Overtime Work',
    'العمل الإضافي هو العمل الذي يؤدى زيادة على ساعات العمل المقررة، ويدفع للعامل عن ساعات العمل الإضافي أجر إضافي يعادل أجر الساعة مضافاً إليه 50% من أجر الساعة العادية.',
    'Overtime work is work performed in addition to prescribed working hours. The worker is paid additional wages for overtime hours equivalent to hourly wage plus 50% of the regular hourly wage.',
    'العمل الإضافي يدفع بأجر الساعة العادية مضاف إليه 50%',
    'Overtime paid at regular hourly rate plus 50%',
    ARRAY['عمل إضافي', 'أجر إضافي', '50%', 'ساعات زائدة'],
    ARRAY['overtime', 'additional wage', '50%', 'extra hours'],
    'نظام العمل السعودي - الباب السابع - المادة 106',
    '2005-04-23'
);

-- Safety Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'SAFETY'),
    'المادة 124',
    'التزامات صاحب العمل في السلامة',
    'Employer Safety Obligations',
    'على صاحب العمل أن يوفر معدات الحماية الشخصية المناسبة للعمال، وأن يدربهم على استعمالها، وأن يوفر التعليمات اللازمة لهم باللغة التي يفهمونها. كما عليه أن يعلق في مكان ظاهر تعليمات السلامة الواجب اتباعها.',
    'The employer must provide appropriate personal protective equipment to workers, train them on its use, and provide necessary instructions in a language they understand. They must also post safety instructions to be followed in a visible location.',
    'على صاحب العمل توفير معدات الحماية والتدريب والتعليمات بلغة مفهومة',
    'Employer must provide protective equipment, training, and instructions in understandable language',
    ARRAY['معدات حماية', 'تدريب', 'تعليمات سلامة', 'لغة مفهومة'],
    ARRAY['protective equipment', 'training', 'safety instructions', 'understandable language'],
    'نظام العمل السعودي - الباب التاسع - المادة 124',
    '2005-04-23'
),
(
    (SELECT id FROM labor_law_categories WHERE code = 'SAFETY'),
    'المادة 126',
    'التزامات العامل في السلامة',
    'Worker Safety Obligations',
    'على العامل أن يتقيد بتعليمات السلامة والصحة المهنية، وأن يحافظ على أدوات الوقاية، وأن يستعملها في الأوقات المحددة، وألا يشغل الآلات التي لا يُسمح له بتشغيلها، وأن يخضع للفحوص الطبية.',
    'The worker must comply with occupational safety and health instructions, maintain protective tools, use them at designated times, not operate machines they are not authorized to operate, and submit to medical examinations.',
    'على العامل التقيد بتعليمات السلامة واستعمال أدوات الوقاية والخضوع للفحوص',
    'Worker must follow safety instructions, use protective tools, and submit to examinations',
    ARRAY['تقيد بالسلامة', 'أدوات وقاية', 'فحوص طبية', 'تشغيل آلات'],
    ARRAY['safety compliance', 'protective tools', 'medical examinations', 'machine operation'],
    'نظام العمل السعودي - الباب التاسع - المادة 126',
    '2005-04-23'
);

-- Contract Articles
INSERT INTO labor_law_articles (
    category_id, article_number, title_ar, title_en, 
    content_ar, content_en, summary_ar, summary_en,
    keywords_ar, keywords_en, source_reference, effective_date
) VALUES 
(
    (SELECT id FROM labor_law_categories WHERE code = 'CONTRACTS'),
    'المادة 50',
    'عقد العمل المحدد المدة وغير المحدد',
    'Fixed-term and Indefinite Employment Contracts',
    'عقد العمل إما أن يكون محدد المدة أو غير محدد المدة. فإذا كان العقد محدد المدة انتهى بانتهاء مدته، وإذا كان غير محدد المدة جاز لأي من طرفيه إنهاؤه، وفقاً لأحكام هذا النظام.',
    'An employment contract is either fixed-term or indefinite. If the contract is fixed-term, it ends when its term expires. If indefinite, either party may terminate it according to the provisions of this system.',
    'عقد العمل إما محدد أو غير محدد المدة مع إمكانية الإنهاء وفق النظام',
    'Employment contract is either fixed or indefinite term with termination per system rules',
    ARRAY['عقد عمل', 'محدد المدة', 'غير محدد', 'إنهاء'],
    ARRAY['employment contract', 'fixed-term', 'indefinite', 'termination'],
    'نظام العمل السعودي - الباب الخامس - المادة 50',
    '2005-04-23'
);

-- Generate embeddings for all inserted articles
-- This would typically be done by the application layer
-- For now, we'll create a placeholder function

CREATE OR REPLACE FUNCTION generate_labor_law_embeddings_placeholder()
RETURNS VOID AS $$
BEGIN
    -- Insert placeholder embeddings for each article
    -- In production, actual embeddings would be generated using OpenAI API
    
    INSERT INTO labor_law_embeddings (article_id, text_content, language, content_type)
    SELECT 
        id,
        title_ar,
        'ar',
        'title'
    FROM labor_law_articles
    WHERE NOT EXISTS (
        SELECT 1 FROM labor_law_embeddings 
        WHERE article_id = labor_law_articles.id 
        AND content_type = 'title' 
        AND language = 'ar'
    );
    
    INSERT INTO labor_law_embeddings (article_id, text_content, language, content_type)
    SELECT 
        id,
        title_en,
        'en',
        'title'
    FROM labor_law_articles
    WHERE NOT EXISTS (
        SELECT 1 FROM labor_law_embeddings 
        WHERE article_id = labor_law_articles.id 
        AND content_type = 'title' 
        AND language = 'en'
    );
    
    INSERT INTO labor_law_embeddings (article_id, text_content, language, content_type)
    SELECT 
        id,
        content_ar,
        'ar',
        'content'
    FROM labor_law_articles
    WHERE NOT EXISTS (
        SELECT 1 FROM labor_law_embeddings 
        WHERE article_id = labor_law_articles.id 
        AND content_type = 'content' 
        AND language = 'ar'
    );
    
    INSERT INTO labor_law_embeddings (article_id, text_content, language, content_type)
    SELECT 
        id,
        content_en,
        'en',
        'content'
    FROM labor_law_articles
    WHERE NOT EXISTS (
        SELECT 1 FROM labor_law_embeddings 
        WHERE article_id = labor_law_articles.id 
        AND content_type = 'content' 
        AND language = 'en'
    );
    
    RAISE NOTICE 'Labor law embeddings placeholders created. Generate actual embeddings using OpenAI API in application layer.';
END;
$$ language 'plpgsql';

-- Execute the placeholder function
SELECT generate_labor_law_embeddings_placeholder();

-- Create indexes on labor law data
CREATE INDEX IF NOT EXISTS idx_labor_law_articles_effective_date ON labor_law_articles(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_labor_law_articles_keywords_ar ON labor_law_articles USING GIN(keywords_ar);
CREATE INDEX IF NOT EXISTS idx_labor_law_articles_keywords_en ON labor_law_articles USING GIN(keywords_en);

-- Function to search labor law articles
CREATE OR REPLACE FUNCTION search_labor_law_articles(
    p_search_term TEXT,
    p_language TEXT DEFAULT 'ar',
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    article_id UUID,
    article_number TEXT,
    title TEXT,
    content TEXT,
    category_name TEXT,
    relevance_score FLOAT
) AS $$
BEGIN
    IF p_language = 'ar' THEN
        RETURN QUERY
        SELECT 
            a.id,
            a.article_number,
            a.title_ar as title,
            a.content_ar as content,
            c.name_ar as category_name,
            ts_rank_cd(
                to_tsvector('arabic', a.title_ar || ' ' || a.content_ar || ' ' || array_to_string(a.keywords_ar, ' ')),
                plainto_tsquery('arabic', p_search_term)
            ) as relevance_score
        FROM labor_law_articles a
        JOIN labor_law_categories c ON c.id = a.category_id
        WHERE 
            a.is_active = true
            AND (
                to_tsvector('arabic', a.title_ar || ' ' || a.content_ar || ' ' || array_to_string(a.keywords_ar, ' ')) 
                @@ plainto_tsquery('arabic', p_search_term)
                OR p_search_term = ANY(a.keywords_ar)
            )
        ORDER BY relevance_score DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT 
            a.id,
            a.article_number,
            a.title_en as title,
            a.content_en as content,
            c.name_en as category_name,
            ts_rank_cd(
                to_tsvector('english', a.title_en || ' ' || a.content_en || ' ' || array_to_string(a.keywords_en, ' ')),
                plainto_tsquery('english', p_search_term)
            ) as relevance_score
        FROM labor_law_articles a
        JOIN labor_law_categories c ON c.id = a.category_id
        WHERE 
            a.is_active = true
            AND (
                to_tsvector('english', a.title_en || ' ' || a.content_en || ' ' || array_to_string(a.keywords_en, ' ')) 
                @@ plainto_tsquery('english', p_search_term)
                OR p_search_term = ANY(a.keywords_en)
            )
        ORDER BY relevance_score DESC
        LIMIT p_limit;
    END IF;
END;
$$ language 'plpgsql' STABLE SECURITY DEFINER;

-- Function to get labor law articles by category
CREATE OR REPLACE FUNCTION get_labor_law_by_category(
    p_category_code TEXT,
    p_language TEXT DEFAULT 'ar'
)
RETURNS TABLE (
    article_id UUID,
    article_number TEXT,
    title TEXT,
    summary TEXT,
    effective_date DATE
) AS $$
BEGIN
    IF p_language = 'ar' THEN
        RETURN QUERY
        SELECT 
            a.id,
            a.article_number,
            a.title_ar as title,
            a.summary_ar as summary,
            a.effective_date
        FROM labor_law_articles a
        JOIN labor_law_categories c ON c.id = a.category_id
        WHERE 
            c.code = p_category_code
            AND a.is_active = true
        ORDER BY a.article_number;
    ELSE
        RETURN QUERY
        SELECT 
            a.id,
            a.article_number,
            a.title_en as title,
            a.summary_en as summary,
            a.effective_date
        FROM labor_law_articles a
        JOIN labor_law_categories c ON c.id = a.category_id
        WHERE 
            c.code = p_category_code
            AND a.is_active = true
        ORDER BY a.article_number;
    END IF;
END;
$$ language 'plpgsql' STABLE SECURITY DEFINER;

-- Create a view for easy access to complete labor law information
CREATE OR REPLACE VIEW labor_law_complete_view AS
SELECT 
    a.id as article_id,
    a.article_number,
    a.title_ar,
    a.title_en,
    a.content_ar,
    a.content_en,
    a.summary_ar,
    a.summary_en,
    a.keywords_ar,
    a.keywords_en,
    a.source_reference,
    a.effective_date,
    c.id as category_id,
    c.name_ar as category_name_ar,
    c.name_en as category_name_en,
    c.code as category_code,
    c.description_ar as category_description_ar,
    c.description_en as category_description_en
FROM labor_law_articles a
JOIN labor_law_categories c ON c.id = a.category_id
WHERE a.is_active = true
ORDER BY c.sort_order, a.article_number;

-- Grant appropriate permissions
GRANT SELECT ON labor_law_complete_view TO authenticated;
GRANT EXECUTE ON FUNCTION search_labor_law_articles(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_labor_law_by_category(TEXT, TEXT) TO authenticated;

-- Final validation
DO $$
DECLARE
    article_count INTEGER;
    category_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO article_count FROM labor_law_articles WHERE is_active = true;
    SELECT COUNT(*) INTO category_count FROM labor_law_categories WHERE is_active = true;
    
    RAISE NOTICE 'Labor law initialization complete:';
    RAISE NOTICE '- Categories: %', category_count;
    RAISE NOTICE '- Articles: %', article_count;
    RAISE NOTICE '- Embedding placeholders created (generate actual embeddings in application)';
    
    IF article_count < 10 THEN
        RAISE WARNING 'Low number of labor law articles. Consider adding more comprehensive data.';
    END IF;
END $$;