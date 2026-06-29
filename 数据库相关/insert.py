import json
import mysql.connector
from mysql.connector import errorcode
import traceback
import os

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'database': 'ojld'
}


# --- Helper function ---
def get_safe(data_dict, key, default=None):
    val = data_dict.get(key)
    # Handle empty strings as None if that's desired for certain fields, otherwise, allow them
    # if isinstance(val, str) and not val.strip():
    #     return default
    return default if val is None else val


# --- Function to clear existing book question links ---
# This function might be used if you want a full reset of links for a book,
# but the new logic in insert_data_from_quest_json is more granular.
def clear_book_data_and_links(cursor, cnx, target_meaningful_book_id_to_clear):
    print(
        f"\n--- Clearing ALL existing question links for Book.BookID (meaningful): {target_meaningful_book_id_to_clear} ---")
    try:
        cursor.execute("DELETE FROM BookQuestions WHERE BookID = %s", (target_meaningful_book_id_to_clear,))
        deleted_count = cursor.rowcount
        cnx.commit()
        print(
            f"  Cleared {deleted_count} entries from BookQuestions for Book.BookID (meaningful): {target_meaningful_book_id_to_clear}")
        return True
    except mysql.connector.Error as err:
        print(
            f"  ERROR clearing BookQuestions for Book.BookID (meaningful) {target_meaningful_book_id_to_clear}: {err}")
        try:
            cnx.rollback()
        except:
            pass
        return False


def insert_global_questions_from_quest_json(cursor, cnx, quest_json_data_dict):
    print("\n--- Populating/Updating Global Questions Table (Questions) from quest.json ---")
    sql_question = """
        INSERT INTO Questions (
            QuestionID, QuestionText, OriginalAnswerText, 
            LegacyOriginalBookID, LegacyOriginalQuestionSort, LinksCount, LinkNames
        ) VALUES (
            %(QuestionID)s, %(QuestionText)s, %(OriginalAnswerText)s,
            %(LegacyOriginalBookID)s, %(LegacyOriginalQuestionSort)s, %(LinksCount)s, %(LinkNames)s
        )
        ON DUPLICATE KEY UPDATE
            QuestionText = VALUES(QuestionText), OriginalAnswerText = VALUES(OriginalAnswerText),
            LegacyOriginalBookID = VALUES(LegacyOriginalBookID), LegacyOriginalQuestionSort = VALUES(LegacyOriginalQuestionSort),
            LinksCount = VALUES(LinksCount), LinkNames = VALUES(LinkNames);
    """
    s, f = 0, 0
    for meaningful_qid_str, q_content in quest_json_data_dict.items():
        val_q = {}
        try:
            if not q_content.get('first_request') or not q_content['first_request'][0]:
                print(f"  Skipping QID {meaningful_qid_str} for Questions table: No first_request data.");
                f += 1;
                continue

            fr_item = q_content['first_request'][0]
            meaningful_qid_int = int(meaningful_qid_str)

            val_q = {
                'QuestionID': meaningful_qid_int,
                'QuestionText': get_safe(fr_item, 'QuestionTxt'),
                'OriginalAnswerText': get_safe(fr_item, 'AnswerTxt'),
                'LegacyOriginalBookID': get_safe(fr_item, 'BookID'),
                'LegacyOriginalQuestionSort': get_safe(fr_item, 'QuestionID'),
                'LinksCount': get_safe(fr_item, 'LinksCount'),
                'LinkNames': get_safe(fr_item, 'LinkNames')}
            cursor.execute(sql_question, val_q);
            s += 1
        except ValueError:
            print(f"  Skipping QID '{meaningful_qid_str}': Not valid int.");
            f += 1
        except mysql.connector.Error as err:
            print(
                f"  MySQL Error Questions (QID {meaningful_qid_str}): {err}\n    Data: {json.dumps(val_q, ensure_ascii=False)}");
            f += 1
        except Exception as py_err:
            print(
                f"  Python Error Questions (QID {meaningful_qid_str}): {py_err}\n    Data: {json.dumps(val_q, ensure_ascii=False)}");
            traceback.print_exc();
            f += 1

    if s > 0 or f > 0:
        try:
            cnx.commit(); print(f"Committed Questions table changes.")
        except mysql.connector.Error as commit_err:
            print(f"Commit error for Questions: {commit_err}")
    print(f"Global Questions table: Successful ops: {s}, Failed: {f}");
    return s, f


def insert_data_from_quest_json(cursor, cnx, target_meaningful_book_id,
                                all_questions_data_dict_from_file,
                                is_new_book_being_created):  # True if creating a new book, False if linking to existing
    question_order_in_book = 0
    stats = {'bq_link': {'s': 0, 'f': 0, 'updated': 0, 'skipped_no_change': 0, 'skipped_no_link_needed': 0},
             'kp': {'s': 0, 'f': 0},
             'qd': {'s': 0, 'f': 0},
             'rq': {'s': 0, 'f': 0}}

    try:
        print("  Disabling foreign key checks for this session during quest.json details import...")
        cursor.execute("SET SESSION foreign_key_checks = 0;")
    except mysql.connector.Error as fk_err:
        print(f"  Warning: Could not disable FK checks: {fk_err}.")

    for source_id_str_from_json_key, question_content in all_questions_data_dict_from_file.items():
        question_order_in_book += 1
        print(
            f"\nProcessing QuestionID (from JSON key for global Questions table): {source_id_str_from_json_key} (Book Order: {question_order_in_book})")

        meaningful_global_question_id = None
        try:
            meaningful_global_question_id = int(source_id_str_from_json_key)
        except ValueError:
            print(
                f"  Skipping all data for JSON key '{source_id_str_from_json_key}': Not a valid integer for QuestionID.");
            continue

        # --- BookQuestions Handling ---
        # The primary purpose of this block is to ensure a link exists in BookQuestions
        # for this global question ID and the target book.
        # If linking to an existing book, we first check if such a link (BookID + QuestionID) already exists.
        # If it does, we might update some of its contextual fields based on quest.json.
        # If it doesn't, or if it's a new book, we insert a new link.

        fr_item_for_bq = question_content.get('first_request', [{}])[0]

        # Contextual data from quest.json's first_request for the BookQuestions link
        quest_json_bq_page = get_safe(fr_item_for_bq, 'QuestionPage')
        quest_json_bq_sort_str = get_safe(fr_item_for_bq,
                                          'QuestionID')  # This is the legacy sort string like "5" or "1(13)"
        # Assuming ChapterName, BookChapter, ChapterSort are NOT typically in quest.json's first_request for BQ context.
        # If they were, extract them:
        # quest_json_chapter_name = get_safe(fr_item_for_bq, 'ChapterName')
        # quest_json_book_chapter = get_safe(fr_item_for_bq, 'BookChapter')
        # quest_json_chapter_sort_val = get_safe(fr_item_for_bq, 'ChapterSort')

        existing_bq_entry_id = None
        if not is_new_book_being_created:
            # For an existing book, check if this QuestionID is already linked to it
            sql_check_existing_bq = "SELECT EntryID FROM BookQuestions WHERE BookID = %s AND QuestionID = %s LIMIT 1"
            cursor.execute(sql_check_existing_bq, (target_meaningful_book_id, meaningful_global_question_id))
            row = cursor.fetchone()
            if row:
                existing_bq_entry_id = row['EntryID']
                print(
                    f"  Found existing BookQuestions link (EntryID: {existing_bq_entry_id}) for BookID {target_meaningful_book_id} and QuestionID {meaningful_global_question_id}.")

        if existing_bq_entry_id is not None:

            # Fields to potentially update:
            fields_to_update_in_bq = {}
            if quest_json_bq_page is not None:
                fields_to_update_in_bq['QuestionPage'] = quest_json_bq_page
            if quest_json_bq_sort_str is not None:
                fields_to_update_in_bq['QuestionSort'] = quest_json_bq_sort_str

            if fields_to_update_in_bq:  # Only update if there's something to change
                update_set_clause = ", ".join([f"`{k}` = %({k})s" for k in fields_to_update_in_bq.keys()])
                update_bq_sql = f"UPDATE BookQuestions SET {update_set_clause} WHERE EntryID = %(EntryID)s"

                val_bq_update = fields_to_update_in_bq.copy()
                val_bq_update['EntryID'] = existing_bq_entry_id

                try:
                    cursor.execute(update_bq_sql, val_bq_update)
                    if cursor.rowcount > 0:
                        print(
                            f"    Updated existing BookQuestions EntryID {existing_bq_entry_id} with data from quest.json.")
                        stats['bq_link']['updated'] += 1
                    else:
                        print(
                            f"    Existing BookQuestions EntryID {existing_bq_entry_id} found, but no fields were changed by the update from quest.json.")
                        stats['bq_link']['skipped_no_change'] += 1
                except mysql.connector.Error as err_bq_update:
                    print(f"    MySQL Error updating BookQuestions EntryID {existing_bq_entry_id}: {err_bq_update}")
                    print(f"      Update SQL: {update_bq_sql}")
                    print(f"      Update Data: {json.dumps(val_bq_update, ensure_ascii=False)}")
                    stats['bq_link']['f'] += 1
            else:
                print(
                    f"    Existing BookQuestions EntryID {existing_bq_entry_id} found. No new contextual data from quest.json to update it with.")
                stats['bq_link']['skipped_no_change'] += 1

        else:  # No existing link for this BookID/QuestionID, OR it's a new book.
            # So, we insert a new BookQuestions entry.
            print(
                f"  No existing BookQuestions link found for BookID {target_meaningful_book_id} and QuestionID {meaningful_global_question_id}, or it's a new book. Creating new link.")
            sql_insert_book_question = """
                INSERT INTO BookQuestions (
                    EntryID, BookID, QuestionID, 
                    QuestionPage, QuestionSort, Sort, 
                    ChapterName, BookChapter, ChapterSort, QuestionImg 
                ) VALUES (
                    %(EntryID)s, %(BookID)s, %(QuestionID)s,
                    %(QuestionPage)s, %(QuestionSort)s, %(Sort)s,
                    %(ChapterName)s, %(BookChapter)s, %(ChapterSort)s, %(QuestionImg)s
                )
                ON DUPLICATE KEY UPDATE 
                    QuestionPage = VALUES(QuestionPage), QuestionSort = VALUES(QuestionSort), Sort = VALUES(Sort),
                    ChapterName = VALUES(ChapterName), BookChapter = VALUES(BookChapter), 
                    ChapterSort = VALUES(ChapterSort), QuestionImg = VALUES(QuestionImg);
            """
            # For new entries derived from quest.json:
            # - EntryID is negative of QuestionID.
            # - Sort is the sequential order of processing quest.json.
            # - ChapterName, BookChapter, ChapterSort, QuestionImg are typically NULL for quest.json-derived entries,
            #   unless fr_item_for_bq provides this book-specific context (unlikely for these fields).
            val_bq_insert = {
                'EntryID': -meaningful_global_question_id,
                'BookID': target_meaningful_book_id,
                'QuestionID': meaningful_global_question_id,
                'QuestionPage': quest_json_bq_page,
                'QuestionSort': quest_json_bq_sort_str,
                'Sort': question_order_in_book,
                'ChapterName': None,  # Or get_safe(fr_item_for_bq, 'ChapterName')
                'BookChapter': None,  # Or get_safe(fr_item_for_bq, 'BookChapter')
                'ChapterSort': None,  # Or get_safe(fr_item_for_bq, 'ChapterSort')
                'QuestionImg': None  # Or get_safe(fr_item_for_bq, 'QuestionImg')
            }
            try:
                cursor.execute(sql_insert_book_question, val_bq_insert)
                stats['bq_link']['s'] += 1
            except mysql.connector.Error as err_bq_insert:
                print(
                    f"  MySQL Error inserting new link into BookQuestions for QID {meaningful_global_question_id} to BookID {target_meaningful_book_id}: {err_bq_insert}");
                print(f"    Data for BookQuestions insert: {json.dumps(val_bq_insert, ensure_ascii=False)}")
                stats['bq_link']['f'] += 1

        # --- End of BookQuestions Handling ---

        # Process KnowledgePoints, QuestionDetails, RelatedQuestions for the GLOBAL question ID
        # These operations are generally independent of whether a BookQuestions link was new or updated,
        # as they pertain to the global definition of the question.

        # KnowledgePoints
        if 'second_request' in question_content and question_content['second_request']:
            for sr_item_idx, sr_item in enumerate(question_content['second_request']):
                linked_kp_db_id_for_detail = None
                if sr_item.get('_question_code') and sr_item['_question_code'].get(
                        'Code') is not None:  # Ensure Code exists
                    kp_code = sr_item['_question_code']['Code']
                    sql_kp = """INSERT INTO KnowledgePoints (KPCode, KPTitle, KPContent, KPType, KPBusType, KPPCode, KPNotes, KPOutlineType, KPDifficultyType)
                                VALUES (%(KPCode)s, %(KPTitle)s, %(KPContent)s, %(KPType)s, %(KPBusType)s, %(KPPCode)s, %(KPNotes)s, %(KPOutlineType)s, %(KPDifficultyType)s)
                                ON DUPLICATE KEY UPDATE KPTitle=VALUES(KPTitle), KPContent=VALUES(KPContent), KPType=VALUES(KPType), KPBusType=VALUES(KPBusType), KPPCode=VALUES(KPPCode), KPNotes=VALUES(KPNotes), KPOutlineType=VALUES(KPOutlineType), KPDifficultyType=VALUES(KPDifficultyType);"""
                    qc_data = sr_item['_question_code']
                    val_kp = {
                        'KPCode': kp_code,
                        'KPTitle': get_safe(qc_data, 'Title', f"KP {kp_code}"),
                        'KPContent': get_safe(qc_data, 'Content'),
                        'KPType': get_safe(qc_data, 'Type'),
                        'KPBusType': get_safe(qc_data, 'BusType'),
                        'KPPCode': get_safe(qc_data, 'PCode'),
                        'KPNotes': get_safe(qc_data, 'Notes'),
                        'KPOutlineType': get_safe(qc_data, 'OutlineType'),
                        'KPDifficultyType': get_safe(qc_data, 'DifficultyType')}
                    try:
                        cursor.execute(sql_kp, val_kp);
                        stats['kp']['s'] += 1
                        cursor.execute("SELECT KnowledgePointID FROM KnowledgePoints WHERE KPCode = %s", (kp_code,))
                        kp_res = cursor.fetchone()
                        if kp_res: linked_kp_db_id_for_detail = kp_res['KnowledgePointID']
                    except mysql.connector.Error as err_kp:
                        print(
                            f"    Error processing KnowledgePoint with KPCode '{kp_code}' for QID {meaningful_global_question_id}, sr_item index {sr_item_idx}: {err_kp.errno} - {err_kp.msg}");
                        stats['kp']['f'] += 1

                # QuestionDetails
                sql_q_detail = """INSERT INTO QuestionDetails (QuestionID, BusType, SourceDetailID, Context, Give, Notes, JsonData, Title, IsProductBook, LinkedKnowledgePointID)
                                  VALUES (%(QuestionID)s, %(BusType)s, %(SourceDetailID)s, %(Context)s, %(Give)s, %(Notes)s, %(JsonData)s, %(Title)s, %(IsProductBook)s, %(LinkedKnowledgePointID)s)
                                  ON DUPLICATE KEY UPDATE Context = VALUES(Context), Give = VALUES(Give), Notes = VALUES(Notes), JsonData = VALUES(JsonData), Title = VALUES(Title), IsProductBook = VALUES(IsProductBook), LinkedKnowledgePointID = VALUES(LinkedKnowledgePointID);"""
                json_data_val = get_safe(sr_item, 'Json')
                json_str = json.dumps(json_data_val, ensure_ascii=False) if json_data_val is not None else None
                current_source_detail_id = get_safe(sr_item, 'ID')
                current_bus_type = get_safe(sr_item, 'BusType', 'N/A')  # Default for NOT NULL
                val_q_detail = {
                    'QuestionID': meaningful_global_question_id,
                    'BusType': current_bus_type, 'SourceDetailID': current_source_detail_id,
                    'Context': get_safe(sr_item, 'Context'), 'Give': get_safe(sr_item, 'Give'),
                    'Notes': get_safe(sr_item, 'Notes'), 'JsonData': json_str,
                    'Title': get_safe(sr_item, 'Title'),
                    'IsProductBook': bool(get_safe(sr_item, 'IsProductBook', 0)),
                    'LinkedKnowledgePointID': linked_kp_db_id_for_detail
                }
                if current_source_detail_id is None:
                    print(
                        f"    Skipping QuestionDetail for QID {meaningful_global_question_id}, sr_item index {sr_item_idx}: SourceDetailID is missing.");
                    stats['qd']['f'] += 1;
                    continue
                try:
                    cursor.execute(sql_q_detail, val_q_detail);
                    stats['qd']['s'] += 1
                except mysql.connector.Error as err_qd:
                    stats['qd']['f'] += 1
                    print(
                        f"    MySQL Error for QuestionDetail (QID {meaningful_global_question_id}, SrcDetID {val_q_detail.get('SourceDetailID')}): {err_qd.errno} - {err_qd.msg}")
                except Exception as e_generic_qd:
                    stats['qd']['f'] += 1
                    print(
                        f"    Python Error for QuestionDetail (QID {meaningful_global_question_id}, SrcDetID {val_q_detail.get('SourceDetailID')}): {e_generic_qd}")

        # RelatedQuestions
        if 'third_request' in question_content and question_content['third_request']:
            sql_rel_q = """INSERT INTO RelatedQuestions (SourceQuestionID, RelatedQuestionOriginalID, SourceThirdRequestID, RelatedQuestionText, LinkNames, FocalLink, QuestionPage)
                           VALUES (%(SourceQuestionID)s, %(RelatedQuestionOriginalID)s, %(SourceThirdRequestID)s, %(RelatedQuestionText)s, %(LinkNames)s, %(FocalLink)s, %(QuestionPage)s)
                           ON DUPLICATE KEY UPDATE SourceThirdRequestID=VALUES(SourceThirdRequestID), RelatedQuestionText=VALUES(RelatedQuestionText), LinkNames=VALUES(LinkNames), FocalLink=VALUES(FocalLink), QuestionPage=VALUES(QuestionPage);"""
            for tr_item_idx, tr_item in enumerate(question_content['third_request']):
                val_rel_q = {}
                try:
                    related_q_orig_id_str = get_safe(tr_item, 'QuestionID')
                    if related_q_orig_id_str is None:
                        print(
                            f"    Skipping RelatedQuestion for SrcQID {meaningful_global_question_id}, tr_item index {tr_item_idx}: RelatedQuestionOriginalID is missing.");
                        stats['rq']['f'] += 1;
                        continue
                    val_rel_q = {
                        'SourceQuestionID': meaningful_global_question_id,
                        'RelatedQuestionOriginalID': related_q_orig_id_str,
                        'SourceThirdRequestID': get_safe(tr_item, 'ID'),
                        'RelatedQuestionText': get_safe(tr_item, 'QuestionTxt'),
                        'LinkNames': get_safe(tr_item, 'LinkNames'),
                        'FocalLink': get_safe(tr_item, 'FocalLink'),
                        'QuestionPage': get_safe(tr_item, 'QuestionPage')}
                    cursor.execute(sql_rel_q, val_rel_q);
                    stats['rq']['s'] += 1
                except mysql.connector.Error as err_rq:
                    stats['rq']['f'] += 1
                    print(
                        f"    MySQL Error for RelatedQuestion (SrcQID {meaningful_global_question_id}, RelQOrigID {val_rel_q.get('RelatedQuestionOriginalID')}): {err_rq.errno} - {err_rq.msg}");
                except Exception as e_generic_rq:
                    stats['rq']['f'] += 1
                    print(
                        f"    Python Error for RelatedQuestion (SrcQID {meaningful_global_question_id}): {e_generic_rq}")

        try:
            cnx.commit();
            print(f"  Committed data related to Global QuestionID: {meaningful_global_question_id}")
        except mysql.connector.Error as commit_err:
            print(
                f"  Commit error for Global QID {meaningful_global_question_id}: {commit_err}. Rolling back this question's changes.")
            try:
                cnx.rollback()
            except Exception as rb_err:
                print(f"  Rollback failed: {rb_err}")

    try:
        print("\n  Re-enabling foreign key checks for this session...");
        cursor.execute("SET SESSION foreign_key_checks = 1;");
        print("  Re-enabled.")
    except Exception as fk_err:
        print(f"  CRITICAL WARNING: Could not re-enable FK checks: {fk_err}")

    print("\n--- Import Statistics for this Book from this JSON file ---")
    for table_key, counts in stats.items():
        name = {"bq_link": "BookQuestions Links", "kp": "KnowledgePoints", "qd": "QuestionDetails",
                "rq": "RelatedQuestions"}.get(table_key, table_key.capitalize())
        success_count = counts.get('s', 0)
        updated_count = counts.get('updated', 0)
        skipped_no_change_count = counts.get('skipped_no_change', 0)
        skipped_no_link_count = counts.get('skipped_no_link_needed', 0)  # Not used in current logic but placeholder
        failed_count = counts.get('f', 0)
        print(
            f"{name}: {success_count} new, {updated_count} updated, {skipped_no_change_count} skipped (no change), {failed_count} failed.")
    return True


# --- Main Execution ---
def main():
    cnx = None;
    cursor = None
    try:
        cnx = mysql.connector.connect(**DB_CONFIG)
        cursor = cnx.cursor(dictionary=True)
        print(f"Connected to DB '{DB_CONFIG['database']}'.")

        json_file_to_process = input("Enter full path to quest.json file to process: ").strip()
        if not os.path.exists(json_file_to_process):
            print(f"File not found: '{json_file_to_process}'. Aborting.");
            return

        all_quest_data_dict = None
        try:
            with open(json_file_to_process, 'r', encoding='utf-8') as f:
                all_quest_data_dict = json.load(f)
            if not isinstance(all_quest_data_dict, dict):
                print(f"Error: Root of '{json_file_to_process}' must be a dictionary. Aborting.");
                return
        except Exception as e:
            print(f"Error loading or parsing '{json_file_to_process}': {e}");
            return

        insert_global_questions_from_quest_json(cursor, cnx, all_quest_data_dict)

        print("\n--- Step 2: Select or Create Target Book ---")
        cursor.execute(
            "SELECT b.ID as InternalBookPK, b.BookID as MeaningfulBookID, b.BookTitle, s.SubjectName FROM Books b JOIN Subjects s ON b.SubjectID = s.SubjectID ORDER BY s.SubjectName, b.BookTitle")
        existing_books_list = cursor.fetchall()
        book_selection_map = {}
        if existing_books_list:
            print("Available Books in Database:")
            for i, book_row in enumerate(existing_books_list):
                selection_key = str(i + 1)
                book_selection_map[selection_key] = book_row['InternalBookPK']
                print(
                    f"  {selection_key}: {book_row['BookTitle']} (Subject: {book_row['SubjectName']}, DB_Internal_PK: {book_row['InternalBookPK']}, MeaningfulBookID: {book_row['MeaningfulBookID']})")
        else:
            print("  No existing books found.")
        print("  0: Create a new book entry")

        book_choice = input("Enter NUMBER of existing book for linking these questions, or 0 for new book: ").strip()

        target_book_meaningful_id_for_bq = None
        book_title_for_log = ""
        selected_book_internal_pk_for_update = None
        is_new_book_flag = False

        if book_choice in book_selection_map:
            is_new_book_flag = False
            selected_book_internal_pk_for_update = book_selection_map[book_choice]
            for br in existing_books_list:
                if br['InternalBookPK'] == selected_book_internal_pk_for_update:
                    book_title_for_log = br['BookTitle']
                    target_book_meaningful_id_for_bq = br['MeaningfulBookID']
                    break
            if target_book_meaningful_id_for_bq is None:
                print("Error: Could not find meaningful BookID for selected book. Aborting.");
                return
            print(
                f"Selected existing book: '{book_title_for_log}' (Internal DB PK: {selected_book_internal_pk_for_update}, Meaningful BookID for BookQuestions: {target_book_meaningful_id_for_bq}).")

            # Update SourceJsonFileName for the book
            cursor.execute("UPDATE Books SET SourceJsonFileName = %s WHERE ID = %s",
                           (os.path.basename(json_file_to_process), selected_book_internal_pk_for_update))
            cnx.commit()
            print(
                f"Updated SourceJsonFileName for Book '{book_title_for_log}' to '{os.path.basename(json_file_to_process)}'.")

        elif book_choice == '0':
            is_new_book_flag = True
            print("\nCreating new book...");
            cursor.execute("SELECT SubjectID, SubjectName FROM Subjects ORDER BY SubjectName")
            subjects_list = cursor.fetchall()
            subjects_map = {str(s['SubjectID']): s['SubjectName'] for s in subjects_list}
            if not subjects_map: print("No subjects in DB! Cannot create book."); return
            for sid, sname in subjects_map.items(): print(f"  {sid}: {sname}")
            sel_subj_id_str = input("Enter Subject NUMBER for the new book: ").strip()
            if sel_subj_id_str not in subjects_map: print("Invalid Subject selection. Aborting."); return
            selected_subject_id = int(sel_subj_id_str)
            new_title = input("Enter Title for the new book: ").strip();
            book_title_for_log = new_title
            if not new_title: print("Book Title cannot be empty. Aborting."); return
            new_mean_bid_str = input(f"Enter a UNIQUE 'Meaningful Book ID' (integer) for '{new_title}': ").strip()
            try:
                target_book_meaningful_id_for_bq = int(new_mean_bid_str)
            except ValueError:
                print("Meaningful Book ID must be an integer. Aborting."); return
            cursor.execute("SELECT ID FROM Books WHERE BookID = %s", (target_book_meaningful_id_for_bq,))
            if cursor.fetchone(): print(
                f"Error: A book with Meaningful Book ID {target_book_meaningful_id_for_bq} already exists. Aborting."); return
            sql_ib = "INSERT INTO Books (BookID, BookTitle, SubjectID, SourceJsonFileName) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql_ib, (
            target_book_meaningful_id_for_bq, new_title, selected_subject_id, os.path.basename(json_file_to_process)))
            selected_book_internal_pk_for_update = cursor.lastrowid
            print(
                f"New book '{new_title}' created. Internal DB PK: {selected_book_internal_pk_for_update}, Meaningful BookID: {target_book_meaningful_id_for_bq}")
            cnx.commit()
        else:
            print("Invalid book selection. Aborting.");
            return

        if not target_book_meaningful_id_for_bq:
            print("Could not determine Target Meaningful Book ID for BookQuestions table. Aborting.");
            return

        print(
            f"\nStarting detailed import of questions from '{json_file_to_process}' linking to Book: '{book_title_for_log}' (Meaningful BookID for BookQuestions: {target_book_meaningful_id_for_bq})...")
        success = insert_data_from_quest_json(cursor, cnx, target_book_meaningful_id_for_bq,
                                              all_quest_data_dict, is_new_book_flag)

        if success:
            print(f"\nImport for book '{book_title_for_log}' processed.")
        else:
            print(f"\nImport for book '{book_title_for_log}' may have issues.")

    except mysql.connector.Error as err:
        print(f"DB Error: {err}");
        traceback.print_exc()
    except Exception as e:
        print(f"Script Error: {e}");
        traceback.print_exc()
    finally:
        if cursor: cursor.close()
        if cnx and cnx.is_connected(): cnx.close(); print("\nMySQL connection closed.")


if __name__ == '__main__':
    main()