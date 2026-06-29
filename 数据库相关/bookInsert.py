import json
import mysql.connector
from mysql.connector import errorcode
import traceback
import os

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',  # !!! REPLACE WITH YOUR ACTUAL PASSWORD !!!
    'database': 'ojld'
}

JSON_FILE_PATH = '../book.json'


def preprocess_image_url(url):
    if url and url.endswith('_yjs'):
        return url[:-4]
    return url


def ensure_books_exist(cursor, cnx, all_book_question_items):
    """
    Extracts unique books from the full dataset and inserts/updates them into the Books table.
    """
    print("\n--- Ensuring Books Exist ---")
    unique_books = {}
    for book_list in all_book_question_items:
        for item in book_list:
            book_id = item.get('BookID')
            book_name = item.get('BookName')
            if book_id is not None and book_name is not None:
                if book_id not in unique_books:
                    subject_id_for_book = item.get('SubjectID')
                    if subject_id_for_book is None:
                        if "数一" in book_name or "数学一" in book_name:
                            subject_id_for_book = 1
                        elif "数二" in book_name or "数学二" in book_name:
                            subject_id_for_book = 2
                        elif "数三" in book_name or "数学三" in book_name:
                            subject_id_for_book = 3
                        else:
                            subject_id_for_book = 1  # Default
                        print(f"BookID {book_id}: Guessed SubjectID {subject_id_for_book}. Verify.")
                    unique_books[book_id] = {
                        'BookID': book_id, 'BookTitle': book_name, 'SubjectID': subject_id_for_book,
                        'VersionInfo': item.get('VersionInfo'), 'LearnerCount': item.get('LearnerCount'),
                        'StyleType': item.get('StyleType'), 'IsNew': item.get('IsNew', False),
                        'OverlayBannerText': item.get('OverlayBannerText'),
                        'ThumbnailText': item.get('ThumbnailText', book_name[:20])
                    }
    if not unique_books: print("No unique book info in JSON for Books table."); return 0, 0
    insert_book_sql = """
        INSERT INTO Books (BookID, BookTitle, SubjectID, VersionInfo, LearnerCount, StyleType, IsNew, OverlayBannerText, ThumbnailText)
        VALUES (%(BookID)s, %(BookTitle)s, %(SubjectID)s, %(VersionInfo)s, %(LearnerCount)s, %(StyleType)s, %(IsNew)s, %(OverlayBannerText)s, %(ThumbnailText)s)
        ON DUPLICATE KEY UPDATE
            BookTitle = VALUES(BookTitle), SubjectID = VALUES(SubjectID), VersionInfo = VALUES(VersionInfo),
            LearnerCount = VALUES(LearnerCount), StyleType = VALUES(StyleType), IsNew = VALUES(IsNew),
            OverlayBannerText = VALUES(OverlayBannerText), ThumbnailText = VALUES(ThumbnailText);"""
    s, f = 0, 0
    for book_id, book_details in unique_books.items():
        try:
            cursor.execute(insert_book_sql, book_details); s += 1
        except mysql.connector.Error as err:
            print(f"Error for BookID {book_id} in Books: {err}");
            if err.errno == 1452: print(f"  Check SubjectID {book_details.get('SubjectID')} in Subjects table.")
            print(f"  Data: {book_details}");
            f += 1
    if s > 0 or f > 0: cnx.commit()
    print(f"Books table: Successful ops: {s}, Failed: {f}");
    return s, f


def ensure_questions_exist(cursor, cnx, all_book_question_items):
    print("\n--- Ensuring Questions Exist (minimal data) ---")
    unique_question_ids = set()
    for book_list in all_book_question_items:
        for item in book_list:
            qid = item.get('QuestionID');
            if qid is not None: unique_question_ids.add(qid)
    if not unique_question_ids: print("No QuestionIDs in JSON for Questions table."); return 0, 0
    insert_question_sql = "INSERT IGNORE INTO Questions (QuestionID, QuestionText) VALUES (%s, NULL);"
    s, f = 0, 0
    for qid in unique_question_ids:
        try:
            cursor.execute(insert_question_sql, (qid,))
            if cursor.rowcount == 1: s += 1
        except mysql.connector.Error as err:
            print(f"Error for QuestionID {qid} in Questions: {err}"); f += 1
    if s > 0 or f > 0: cnx.commit()
    print(f"Questions table: New questions added: {s}, Failed: {f}");
    return s, f


# MODIFIED FUNCTION
def insert_book_question_data(cursor, cnx, book_data_list):
    """
    Inserts a list of question data for a single book into the BookQuestions table,
    using the 'ID' from JSON as the 'EntryID' primary key.
    """
    insert_sql = """
        INSERT INTO BookQuestions (
            EntryID, BookID, QuestionID, 
            QuestionPage, QuestionSort, Sort, 
            ChapterName, BookChapter, ChapterSort, 
            QuestionImg
        ) VALUES (
            %(EntryID)s, %(BookID)s, %(QuestionID)s,
            %(QuestionPage)s, %(QuestionSort)s, %(Sort)s,
            %(ChapterName)s, %(BookChapter)s, %(ChapterSort)s,
            %(QuestionImg)s
        )
        ON DUPLICATE KEY UPDATE
            BookID = VALUES(BookID), 
            QuestionID = VALUES(QuestionID),
            QuestionPage = VALUES(QuestionPage),
            QuestionSort = VALUES(QuestionSort),
            Sort = VALUES(Sort),
            ChapterName = VALUES(ChapterName),
            BookChapter = VALUES(BookChapter),
            ChapterSort = VALUES(ChapterSort),
            QuestionImg = VALUES(QuestionImg);
    """
    successful_operations = 0
    failed_operations = 0
    for question_item in book_data_list:
        data_to_insert = {}
        try:
            entry_id_from_json = question_item.get('ID')  # Get the ID from JSON
            if entry_id_from_json is None:
                print(f"Skipping item: JSON 'ID' field is missing (needed for EntryID).")
                failed_operations += 1
                continue

            data_to_insert = {
                'EntryID': entry_id_from_json,  # **** THIS IS THE KEY CHANGE ****
                'BookID': question_item.get('BookID'),
                'QuestionID': question_item.get('QuestionID'),
                'QuestionPage': question_item.get('QuestionPage'),
                'QuestionSort': question_item.get('QuestionSort'),
                'Sort': question_item.get('Sort'),
                'ChapterName': question_item.get('ChapterName'),
                'BookChapter': question_item.get('BookChapter'),
                'ChapterSort': question_item.get('ChapterSort'),
                'QuestionImg': preprocess_image_url(question_item.get('QuestionImg'))
            }

            if data_to_insert['BookID'] is None:
                print(f"Warning: Missing BookID for EntryID {entry_id_from_json}. Will insert NULL if column allows.")
            if data_to_insert['QuestionID'] is None:
                print(
                    f"Warning: Missing QuestionID for EntryID {entry_id_from_json}. Will insert NULL if column allows.")

            cursor.execute(insert_sql, data_to_insert)
            successful_operations += 1
        except mysql.connector.Error as err:
            print("-" * 30);
            print(f"MySQL Error (BookQuestions): {err.errno} - {err.msg}");
            print(f"SQLSTATE: {err.sqlstate}")
            print(f"Error for JSON ID {question_item.get('ID', 'N/A')}")  # Log original JSON ID
            print(f"Data being inserted: {data_to_insert}");
            print("-" * 30);
            failed_operations += 1
        except Exception as e:
            print("-" * 30);
            print(f"Python error (BookQuestions) JSON ID {question_item.get('ID', 'N/A')}: {e}")
            print(f"Data: {data_to_insert}");
            print(traceback.format_exc());
            print("-" * 30);
            failed_operations += 1

    print(f"BookQuestions batch. Successful ops: {successful_operations}, Failed ops: {failed_operations}")
    return successful_operations, failed_operations


# END OF MODIFIED FUNCTION


def main_upload_book_questions():
    if not os.path.exists(JSON_FILE_PATH):
        print(f"Error: Data file '{JSON_FILE_PATH}' not found.");
        return
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            all_books_data = json.load(f)
    except json.JSONDecodeError as je:
        print(f"Error: Could not decode JSON. Details: {je}"); return
    except Exception as e:
        print(f"Error reading JSON file: {e}"); return
    if not isinstance(all_books_data, list): print(f"Error: JSON root not a list."); return

    cnx = None;
    cursor = None
    total_bq_successful_ops = 0;
    total_bq_failed_ops = 0

    try:
        print(f"Connecting to database '{DB_CONFIG['database']}'...")
        cnx = mysql.connector.connect(**DB_CONFIG);
        cursor = cnx.cursor()
        print("Successfully connected.")

        ensure_books_exist(cursor, cnx, all_books_data)
        ensure_questions_exist(cursor, cnx, all_books_data)

        print("\n--- Uploading BookQuestions Data ---")
        try:
            print("Disabling foreign key checks for BookQuestions import (safeguard)...")
            cursor.execute("SET SESSION foreign_key_checks = 0;")

            for book_index, single_book_question_list in enumerate(all_books_data):
                if not isinstance(single_book_question_list, list):
                    print(f"Warning: Item at index {book_index} not a list. Skipping.");
                    continue
                book_id_log = single_book_question_list[0].get('BookID',
                                                               'Unknown') if single_book_question_list and isinstance(
                    single_book_question_list[0], dict) else 'Empty'
                print(
                    f"\nProcessing BookQuestions for Book (approx. BookID: {book_id_log}, JSON index: {book_index})...")
                s_ops, f_ops = insert_book_question_data(cursor, cnx, single_book_question_list)
                total_bq_successful_ops += s_ops;
                total_bq_failed_ops += f_ops

            if total_bq_successful_ops > 0:
                print("Committing all BookQuestions operations...");
                cnx.commit();
                print("Committed.")
            else:
                print("No successful BookQuestions operations to commit.")

        except Exception as e_bq_upload:
            print(f"Error during BookQuestions upload: {e_bq_upload}");
            traceback.print_exc()
            try:
                cnx.rollback(); print("Rolled back changes.")
            except Exception as rb_err:
                print(f"Rollback failed: {rb_err}")
        finally:
            try:
                print("Re-enabling foreign key checks...");
                cursor.execute("SET SESSION foreign_key_checks = 1;");
                print("Re-enabled.")
            except Exception as fk_final_err:
                print(f"WARNING: Error re-enabling FK checks: {fk_final_err}")

        total_json_items = sum(len(bl) for bl in all_books_data if isinstance(bl, list))
        print(f"\n--- Overall Upload Summary '{JSON_FILE_PATH}' ---")
        print(f"Total individual question entries in JSON: {total_json_items}")
        print(f"Total Successful BookQuestions DB Operations (based on EntryID): {total_bq_successful_ops}")
        print(f"Total Failed BookQuestions DB Operations: {total_bq_failed_ops}")

    except mysql.connector.Error as err:
        print(f"MySQL Error: {err}"); traceback.print_exc()
    except Exception as e:
        print(f"Unexpected error: {e}"); traceback.print_exc()
    finally:
        if cursor: cursor.close()
        if cnx and cnx.is_connected(): cnx.close(); print(f"MySQL connection closed.")


if __name__ == '__main__':
    main_upload_book_questions()