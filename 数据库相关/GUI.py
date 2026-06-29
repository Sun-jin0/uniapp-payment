import sys
import os
import json
import traceback
import mysql.connector
from mysql.connector import errorcode

from PyQt5.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                             QFileDialog, QLabel, QTabWidget, QTextEdit, QComboBox,
                             QLineEdit, QMessageBox, QProgressDialog, QGroupBox, QFormLayout,
                             QSizePolicy)  # Added QSizePolicy
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QIcon  # Optional for better styling

# --- 数据库配置 ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',  # !!! 请替换为您的实际密码 !!!
    'database': 'ojld'
}

# --- 表定义 (与之前相同) ---
TABLES = {}
TABLES['Subjects'] = (
    "CREATE TABLE IF NOT EXISTS `Subjects` ("
    "  `SubjectID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `SubjectName` VARCHAR(100) NOT NULL UNIQUE"
    ") ENGINE=InnoDB")

TABLES['Books'] = (
    "CREATE TABLE IF NOT EXISTS `Books` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `BookID` INT NOT NULL UNIQUE,"
    "  `BookTitle` VARCHAR(255) NOT NULL,"
    "  `SubjectID` INT NOT NULL,"
    "  `SourceJsonFileName` VARCHAR(255) NULL,"
    "  `Description` TEXT NULL,"
    "  `CreationTimestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    "  `VersionInfo` VARCHAR(100) NULL,"
    "  `LearnerCount` INT NULL,"
    "  `StyleType` VARCHAR(20) NULL,"
    "  `IsNew` BOOLEAN NULL DEFAULT FALSE,"
    "  `OverlayBannerText` VARCHAR(100) NULL,"
    "  `ThumbnailText` VARCHAR(100) NULL,"
    "  FOREIGN KEY (`SubjectID`) REFERENCES `Subjects`(`SubjectID`) ON DELETE RESTRICT ON UPDATE CASCADE,"
    "  INDEX `idx_books_bookid_meaningful` (`BookID`)"
    ") ENGINE=InnoDB")

TABLES['Questions'] = (
    "CREATE TABLE IF NOT EXISTS `Questions` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `QuestionID` INT NOT NULL UNIQUE COMMENT '来自外部源的唯一全局问题标识符',"
    "  `QuestionText` TEXT NULL,"
    "  `OriginalAnswerText` TEXT NULL,"
    "  `LegacyOriginalBookID` INT NULL,"
    "  `LegacyOriginalQuestionSort` VARCHAR(50) NULL,"
    "  `LinksCount` VARCHAR(255) NULL,"
    "  `LinkNames` TEXT NULL,"
    "  INDEX `idx_questions_questionid_meaningful` (`QuestionID`)"
    ") ENGINE=InnoDB")

TABLES['BookQuestions'] = (
    "CREATE TABLE IF NOT EXISTS `BookQuestions` ("
    "  `EntryID` INT NOT NULL PRIMARY KEY COMMENT '本书籍-问题条目的唯一ID (来自JSON的ID字段)',"
    "  `BookID` INT NOT NULL COMMENT '来自JSON的上下文书籍ID',"
    "  `QuestionID` INT NOT NULL COMMENT '来自JSON的上下文问题ID',"
    "  `QuestionPage` VARCHAR(20) NULL,"
    "  `QuestionSort` VARCHAR(10) NULL COMMENT '来自JSON的页面/章节特定排序 (可重复)',"
    "  `Sort` INT NULL COMMENT '本书在此上下文中问题的整体排序顺序/编号 (来自JSON的Sort - 不同EntryID可重复)',"
    "  `ChapterName` VARCHAR(255) NULL,"
    "  `BookChapter` VARCHAR(255) NULL,"
    "  `ChapterSort` INT NULL,"
    "  `QuestionImg` VARCHAR(512) NULL,"
    "  INDEX `idx_bq_bookid` (`BookID`),"
    "  INDEX `idx_bq_questionid` (`QuestionID`),"
    "  INDEX `idx_bq_bookid_sort` (`BookID`, `Sort`)"
    ") ENGINE=InnoDB COMMENT='将书籍与问题及其上下文链接。EntryID唯一 (JSON ID)。Sort可重复。'")

TABLES['KnowledgePoints'] = (
    "CREATE TABLE IF NOT EXISTS `KnowledgePoints` ("
    "  `KnowledgePointID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `KPCode` VARCHAR(50) UNIQUE COMMENT '如果是自然键，数据导入应在此键上使用ON DUPLICATE KEY UPDATE',"
    "  `KPTitle` VARCHAR(255) NOT NULL,"
    "  `KPContent` TEXT,"
    "  `KPType` VARCHAR(50),"
    "  `KPBusType` VARCHAR(50),"
    "  `KPPCode` VARCHAR(50),"
    "  `KPNotes` TEXT,"
    "  `KPOutlineType` VARCHAR(50),"
    "  `KPDifficultyType` VARCHAR(50)"
    ") ENGINE= InnoDB")

TABLES['QuestionDetails'] = (
    "CREATE TABLE IF NOT EXISTS `QuestionDetails` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `QuestionID` INT NOT NULL,"
    "  `BusType` VARCHAR(50) NOT NULL,"
    "  `Context` TEXT,"
    "  `Give` INT,"
    "  `Notes` TEXT,"
    "  `JsonData` TEXT,"
    "  `Title` VARCHAR(255),"
    "  `IsProductBook` BOOLEAN DEFAULT 0,"
    "  `LinkedKnowledgePointID` INT NULL,"
    "  `SourceDetailID` INT NULL COMMENT 'JSON second_request条目的原始ID，供参考',"
    "  FOREIGN KEY (`LinkedKnowledgePointID`) REFERENCES `KnowledgePoints`(`KnowledgePointID`) ON DELETE SET NULL ON UPDATE CASCADE,"
    "  UNIQUE KEY `UQ_QuestionDetailItem` (`QuestionID`, `BusType`, `SourceDetailID`) COMMENT '假设SourceDetailID在QuestionID和BusType上下文中是唯一的',"
    "  INDEX `idx_qdetails_questionid` (`QuestionID`)"
    ") ENGINE=InnoDB")

TABLES['RelatedQuestions'] = (
    "CREATE TABLE IF NOT EXISTS `RelatedQuestions` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `SourceQuestionID` INT NOT NULL,"
    "  `RelatedQuestionOriginalID` VARCHAR(50) NOT NULL COMMENT '相关问题的标识符 (例如另一个QuestionID)',"
    "  `RelatedQuestionText` TEXT NULL,"
    "  `LinkNames` TEXT NULL,"
    "  `FocalLink` INT NULL,"
    "  `QuestionPage` VARCHAR(20) NULL,"
    "  `SourceThirdRequestID` INT NULL COMMENT 'JSON third_request条目的原始ID，供参考',"
    "  UNIQUE KEY `UQ_RelatedQuestionPair` (`SourceQuestionID`, `RelatedQuestionOriginalID`) COMMENT '防止为源问题重复添加相同的相关问题链接',"
    "  INDEX `idx_relatedq_sourceqid` (`SourceQuestionID`)"
    ") ENGINE=InnoDB")

TABLE_PROCESSING_ORDER = [
    'RelatedQuestions', 'BookQuestions', 'QuestionDetails', 'KnowledgePoints', 'Questions', 'Books', 'Subjects'
]


# --- 后台工作线程 ---
class WorkerThread(QThread):
    signal_log = pyqtSignal(str)
    signal_finished = pyqtSignal(str)
    signal_progress_max = pyqtSignal(int)
    signal_progress_value = pyqtSignal(int)
    signal_populate_book_combo = pyqtSignal(list)

    def __init__(self, task_type, **kwargs):
        super().__init__()
        self.task_type = task_type
        self.kwargs = kwargs
        self.cnx = None
        self.cursor = None

    def connect_db(self):
        try:
            self.cnx = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.cnx.cursor(dictionary=True)
            self.signal_log.emit(f"成功连接到数据库 '{DB_CONFIG['database']}'.")
            return True
        except mysql.connector.Error as err:
            self.signal_log.emit(f"数据库连接错误: {err}")
            self.signal_finished.emit(f"数据库连接错误: {err}")
            return False
        except Exception as e:
            self.signal_log.emit(f"数据库连接 - 未知错误: {e}")
            self.signal_finished.emit(f"数据库连接 - 未知错误: {e}")
            return False

    def close_db(self):
        if self.cursor: self.cursor.close()
        if self.cnx and self.cnx.is_connected(): self.cnx.close()
        self.signal_log.emit(f"与数据库 '{DB_CONFIG['database']}' 的连接已关闭。")

    def run(self):
        if not self.connect_db():
            return

        try:
            if self.task_type == "reset_schema":
                self.reset_schema_task()
            elif self.task_type == "import_book_json":
                self.import_book_json_task()
            elif self.task_type == "import_quest_json":
                self.import_quest_json_task()
            elif self.task_type == "fetch_books":
                self.fetch_books_task()
        except Exception as e:
            error_msg = f"任务 '{self.task_type}' 执行出错: {e}\n{traceback.format_exc()}"
            self.signal_log.emit(error_msg)
            self.signal_finished.emit(f"任务 '{self.task_type}' 失败。详情请查看日志。")
        finally:
            self.close_db()

    def reset_schema_task(self):
        self.signal_log.emit("开始重置并创建数据库结构...")
        try:
            self.signal_log.emit("\n--- 正在删除所有现有表 ---")
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            for table_name in TABLE_PROCESSING_ORDER:
                self.signal_log.emit(f"正在删除表 `{table_name}`... ")
                self.cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
            self.cnx.commit()
            self.signal_log.emit("完成删除表。")

            creation_order = TABLE_PROCESSING_ORDER[::-1]
            self.signal_log.emit("\n--- 正在创建表 ---")
            for table_name in creation_order:
                if table_name not in TABLES:
                    self.signal_log.emit(f"警告: 未找到表 '{table_name}' 的定义。跳过。")
                    continue
                self.signal_log.emit(f"正在创建表 `{table_name}`... ")
                self.cursor.execute(TABLES[table_name])
            self.cnx.commit()
            self.signal_log.emit("表已创建。")

            self.signal_log.emit("\n--- 正在预填充 Subjects 表 ---")
            for subject_name in ["数学一", "数学二", "数学三"]:  # 使用中文
                self.cursor.execute("INSERT IGNORE INTO Subjects (SubjectName) VALUES (%s)", (subject_name,))
            self.cnx.commit()
            self.signal_log.emit("Subjects 表预填充完成。")
            self.signal_finished.emit("数据库结构重置并创建成功！")

        except mysql.connector.Error as err:
            self.signal_log.emit(f"数据库结构重置期间发生MySQL错误: {err}")
            self.signal_finished.emit(f"数据库结构重置失败: {err}")
            try:
                self.cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
            except:
                pass
        except Exception as e:
            self.signal_log.emit(f"数据库结构重置期间发生未知错误: {e}\n{traceback.format_exc()}")
            self.signal_finished.emit(f"数据库结构重置意外失败。")

    def import_book_json_task(self):
        json_file_path = self.kwargs.get('json_file_path')
        self.signal_log.emit(f"开始从 `book.json` 导入: {json_file_path}")
        # ... (与之前相同的导入 book.json 的逻辑, 但日志信息使用中文)
        # 例如: self.signal_log.emit("正在处理书籍信息以确保存在于 Books 表...")
        # 确保 _ensure_books_exist_from_book_json, _ensure_questions_exist_from_book_json,
        # _insert_book_question_data_from_book_json 中的 self.signal_log.emit() 也使用中文
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                all_books_data = json.load(f)
            if not isinstance(all_books_data, list):
                self.signal_log.emit(f"错误: '{json_file_path}' 的JSON根节点不是列表。")
                self.signal_finished.emit(f"从 '{os.path.basename(json_file_path)}' 导入失败: JSON结构无效。")
                return

            self.signal_log.emit("正在从book.json确保书籍和最少问题条目存在...")
            s_books, f_books = self._ensure_books_exist_from_book_json(all_books_data)
            s_qs, f_qs = self._ensure_questions_exist_from_book_json(all_books_data)
            self.signal_log.emit(f"书籍确保: {s_books} 成功, {f_books} 失败。")
            self.signal_log.emit(f"最少问题条目确保: {s_qs} 新增, {f_qs} 失败。")

            self.signal_log.emit("\n--- 正在从 book.json 上传 BookQuestions 数据 ---")
            total_items = sum(len(book_list) for book_list in all_books_data if isinstance(book_list, list))
            self.signal_progress_max.emit(total_items)
            current_progress = 0
            total_bq_successful_ops = 0
            total_bq_failed_ops = 0

            self.cursor.execute("SET SESSION foreign_key_checks = 0;")
            for book_index, single_book_question_list in enumerate(all_books_data):
                if not isinstance(single_book_question_list, list):
                    self.signal_log.emit(f"警告: JSON索引 {book_index} 处的条目不是列表。跳过。");
                    continue

                s_ops, f_ops = self._insert_book_question_data_from_book_json(single_book_question_list)
                total_bq_successful_ops += s_ops;
                total_bq_failed_ops += f_ops
                current_progress += len(single_book_question_list)
                self.signal_progress_value.emit(current_progress)

            if total_bq_successful_ops > 0 or total_bq_failed_ops > 0:
                self.cnx.commit();
                self.signal_log.emit("已提交 BookQuestions 操作。")
            self.cursor.execute("SET SESSION foreign_key_checks = 1;")

            self.signal_log.emit(f"\n--- `book.json` 导入摘要 ---")
            self.signal_log.emit(f"BookQuestions 总成功操作数: {total_bq_successful_ops}")
            self.signal_log.emit(f"BookQuestions 总失败操作数: {total_bq_failed_ops}")
            self.signal_finished.emit(f"从 '{os.path.basename(json_file_path)}' 导入完成。详情请查看日志。")

        except json.JSONDecodeError as je:  # ... (错误处理保持不变, 但消息可能是中文)
            self.signal_log.emit(f"解码 {json_file_path} 出错: {je}")
            self.signal_finished.emit(f"导入失败: '{os.path.basename(json_file_path)}' JSON解码错误。")
        except mysql.connector.Error as err:
            self.signal_log.emit(f"book.json导入期间MySQL错误: {err}")
            self.signal_finished.emit(f"导入失败: MySQL错误。 {err.msg}")
        except Exception as e:
            self.signal_log.emit(f"book.json导入期间未知错误: {e}\n{traceback.format_exc()}")
            self.signal_finished.emit(f"导入意外失败。详情请查看日志。")

    def _ensure_books_exist_from_book_json(self, all_book_question_items):
        self.signal_log.emit("正在处理唯一书籍以存入 Books 表...")
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
                                subject_id_for_book = 1
                            self.signal_log.emit(f"  BookID {book_id}: 推测 SubjectID 为 {subject_id_for_book} (请核实)。")
                        unique_books[book_id] = {
                            'BookID': book_id, 'BookTitle': book_name, 'SubjectID': subject_id_for_book,
                            'VersionInfo': item.get('VersionInfo'), 'LearnerCount': item.get('LearnerCount'),
                            'StyleType': item.get('StyleType'), 'IsNew': item.get('IsNew', False),
                            'OverlayBannerText': item.get('OverlayBannerText'),
                            'ThumbnailText': item.get('ThumbnailText', book_name[:20])}
        if not unique_books: self.signal_log.emit("book.json中没有唯一的书籍信息。"); return 0, 0
        insert_book_sql = """
            INSERT INTO Books (BookID, BookTitle, SubjectID, VersionInfo, LearnerCount, StyleType, IsNew, OverlayBannerText, ThumbnailText)
            VALUES (%(BookID)s, %(BookTitle)s, %(SubjectID)s, %(VersionInfo)s, %(LearnerCount)s, %(StyleType)s, %(IsNew)s, %(OverlayBannerText)s, %(ThumbnailText)s)
            ON DUPLICATE KEY UPDATE BookTitle=VALUES(BookTitle), SubjectID=VALUES(SubjectID), VersionInfo=VALUES(VersionInfo), LearnerCount=VALUES(LearnerCount), StyleType=VALUES(StyleType), IsNew=VALUES(IsNew), OverlayBannerText=VALUES(OverlayBannerText), ThumbnailText=VALUES(ThumbnailText);"""
        s, f = 0, 0
        for book_id, book_details in unique_books.items():
            try:
                self.cursor.execute(insert_book_sql, book_details); s += 1
            except mysql.connector.Error as err:
                self.signal_log.emit(f"  处理 BookID {book_id} (Books表) 时出错: {err}"); f += 1
        if s > 0 or f > 0: self.cnx.commit()
        return s, f

    def _ensure_questions_exist_from_book_json(self, all_book_question_items):
        self.signal_log.emit("正在处理唯一QuestionID以存入 Questions 表 (最少信息)...")
        unique_question_ids = set()
        for book_list in all_book_question_items:
            for item in book_list:
                qid = item.get('QuestionID');
                if qid is not None: unique_question_ids.add(qid)
        if not unique_question_ids: self.signal_log.emit("book.json中没有QuestionID。"); return 0, 0
        insert_question_sql = "INSERT IGNORE INTO Questions (QuestionID, QuestionText) VALUES (%s, NULL);"
        s, f = 0, 0
        for qid in unique_question_ids:
            try:
                self.cursor.execute(insert_question_sql, (qid,))
                if self.cursor.rowcount == 1: s += 1
            except mysql.connector.Error as err:
                self.signal_log.emit(f"  处理 QID {qid} (Questions表) 时出错: {err}"); f += 1
        if s > 0 or f > 0: self.cnx.commit()
        return s, f

    def _insert_book_question_data_from_book_json(self, book_data_list):
        insert_sql = """
            INSERT INTO BookQuestions (EntryID, BookID, QuestionID, QuestionPage, QuestionSort, Sort, ChapterName, BookChapter, ChapterSort, QuestionImg) 
            VALUES (%(EntryID)s, %(BookID)s, %(QuestionID)s, %(QuestionPage)s, %(QuestionSort)s, %(Sort)s, %(ChapterName)s, %(BookChapter)s, %(ChapterSort)s, %(QuestionImg)s)
            ON DUPLICATE KEY UPDATE BookID=VALUES(BookID), QuestionID=VALUES(QuestionID), QuestionPage=VALUES(QuestionPage), QuestionSort=VALUES(QuestionSort), Sort=VALUES(Sort), ChapterName=VALUES(ChapterName), BookChapter=VALUES(BookChapter), ChapterSort=VALUES(ChapterSort), QuestionImg=VALUES(QuestionImg);"""
        s, f = 0, 0
        for item in book_data_list:
            entry_id = item.get('ID')
            if entry_id is None: self.signal_log.emit("跳过条目: JSON 'ID' (用于EntryID) 缺失。"); f += 1; continue
            img_url = item.get('QuestionImg');
            if img_url and img_url.endswith('_yjs'): img_url = img_url[:-4]
            data = {'EntryID': entry_id, 'BookID': item.get('BookID'), 'QuestionID': item.get('QuestionID'),
                    'QuestionPage': item.get('QuestionPage'), 'QuestionSort': item.get('QuestionSort'),
                    'Sort': item.get('Sort'),
                    'ChapterName': item.get('ChapterName'), 'BookChapter': item.get('BookChapter'),
                    'ChapterSort': item.get('ChapterSort'), 'QuestionImg': img_url}
            try:
                self.cursor.execute(insert_sql, data); s += 1
            except mysql.connector.Error as err:
                self.signal_log.emit(f"  处理 BookQuestions (EntryID {entry_id}) 时出错: {err.msg}\n    数据: {data}"); f += 1
        return s, f

    def import_quest_json_task(self):
        json_file_path = self.kwargs.get('json_file_path')
        target_book_meaningful_id = self.kwargs.get('target_book_meaningful_id')
        is_new_book = self.kwargs.get('is_new_book', False)
        book_title_for_log = self.kwargs.get('book_title_for_log', f"BookID {target_book_meaningful_id}")

        self.signal_log.emit(
            f"开始从 `quest.json` 导入: {json_file_path}，目标书籍: '{book_title_for_log}' (Meaningful BookID: {target_book_meaningful_id})")
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                all_quest_data_dict = json.load(f)
            if not isinstance(all_quest_data_dict, dict):
                self.signal_log.emit(f"错误: '{json_file_path}' 的JSON根节点必须是字典。")
                self.signal_finished.emit(f"导入失败: '{os.path.basename(json_file_path)}' JSON结构无效。")
                return

            self.signal_log.emit("正在从quest.json填充/更新全局Questions表...")
            s_global_q, f_global_q = self._insert_global_questions_from_quest_json(all_quest_data_dict)
            self.signal_log.emit(f"全局Questions: {s_global_q} 成功, {f_global_q} 失败。")

            self.signal_log.emit(
                f"\n正在从 '{os.path.basename(json_file_path)}' 处理 {len(all_quest_data_dict)} 个问题的详细信息...")
            self.signal_progress_max.emit(len(all_quest_data_dict))

            stats = self._insert_data_from_quest_json_details(target_book_meaningful_id, all_quest_data_dict,
                                                              is_new_book)

            self.signal_log.emit(f"\n--- `quest.json` 导入摘要 (书籍 '{book_title_for_log}') ---")
            for table_key, counts in stats.items():
                name_map = {"bq_link": "书籍问题链接 (BookQuestions)", "kp": "知识点 (KnowledgePoints)",
                            "qd": "问题详情 (QuestionDetails)", "rq": "相关问题 (RelatedQuestions)"}
                name = name_map.get(table_key, table_key.capitalize())
                self.signal_log.emit(
                    f"{name}: {counts.get('s', 0)} 新增, {counts.get('updated', 0)} 更新, {counts.get('skipped_no_change', 0)} 跳过(无变化), {counts.get('f', 0)} 失败。")
            self.signal_finished.emit(f"从 '{os.path.basename(json_file_path)}' 为 '{book_title_for_log}' 导入完成。")

        except json.JSONDecodeError as je:
            self.signal_log.emit(f"解码 {json_file_path} 出错: {je}")
            self.signal_finished.emit(f"导入失败: '{os.path.basename(json_file_path)}' JSON解码错误。")
        except mysql.connector.Error as err:
            self.signal_log.emit(f"quest.json导入期间MySQL错误: {err}")
            self.signal_finished.emit(f"导入失败: MySQL错误。 {err.msg}")
        except Exception as e:
            self.signal_log.emit(f"quest.json导入期间未知错误: {e}\n{traceback.format_exc()}")
            self.signal_finished.emit(f"导入意外失败。详情请查看日志。")

    def _get_safe_from_dict(self, data_dict, key, default=None):
        val = data_dict.get(key)
        return default if val is None else val

    def _insert_global_questions_from_quest_json(self, quest_json_data_dict):
        sql_question = """
            INSERT INTO Questions (QuestionID, QuestionText, OriginalAnswerText, LegacyOriginalBookID, LegacyOriginalQuestionSort, LinksCount, LinkNames) 
            VALUES (%(QuestionID)s, %(QuestionText)s, %(OriginalAnswerText)s, %(LegacyOriginalBookID)s, %(LegacyOriginalQuestionSort)s, %(LinksCount)s, %(LinkNames)s)
            ON DUPLICATE KEY UPDATE QuestionText=VALUES(QuestionText), OriginalAnswerText=VALUES(OriginalAnswerText), LegacyOriginalBookID=VALUES(LegacyOriginalBookID), LegacyOriginalQuestionSort=VALUES(LegacyOriginalQuestionSort), LinksCount=VALUES(LinksCount), LinkNames=VALUES(LinkNames);"""
        s, f = 0, 0
        for qid_str, q_content in quest_json_data_dict.items():
            val_q = {};
            fr = q_content.get('first_request', [{}])[0]
            try:
                if not fr: self.signal_log.emit(f"  跳过QID {qid_str} (Questions表): 无first_request数据。"); f += 1; continue
                qid_int = int(qid_str)
                val_q = {'QuestionID': qid_int, 'QuestionText': self._get_safe_from_dict(fr, 'QuestionTxt'),
                         'OriginalAnswerText': self._get_safe_from_dict(fr, 'AnswerTxt'),
                         'LegacyOriginalBookID': self._get_safe_from_dict(fr, 'BookID'),
                         'LegacyOriginalQuestionSort': self._get_safe_from_dict(fr, 'QuestionID'),
                         'LinksCount': self._get_safe_from_dict(fr, 'LinksCount'),
                         'LinkNames': self._get_safe_from_dict(fr, 'LinkNames')}
                self.cursor.execute(sql_question, val_q);
                s += 1
            except ValueError:
                self.signal_log.emit(f"  跳过QID '{qid_str}': 非有效整数。"); f += 1
            except mysql.connector.Error as err:
                self.signal_log.emit(f"  处理Questions (QID {qid_str})时MySQL错误: {err.msg}"); f += 1
        if s > 0 or f > 0: self.cnx.commit()
        return s, f

    def _insert_data_from_quest_json_details(self, target_meaningful_book_id, all_questions_data_dict, is_new_book):
        stats = {'bq_link': {'s': 0, 'f': 0, 'updated': 0, 'skipped_no_change': 0},
                 'kp': {'s': 0, 'f': 0}, 'qd': {'s': 0, 'f': 0}, 'rq': {'s': 0, 'f': 0}}
        question_order = 0
        self.cursor.execute("SET SESSION foreign_key_checks = 0;")

        for qid_str_key, q_content in all_questions_data_dict.items():
            question_order += 1;
            self.signal_progress_value.emit(question_order)
            self.signal_log.emit(f"\n正在处理来自quest.json的QID: {qid_str_key} (书籍内顺序: {question_order})")
            global_qid = None
            try:
                global_qid = int(qid_str_key)
            except ValueError:
                self.signal_log.emit(f"  跳过QID '{qid_str_key}': 非有效整数。"); continue

            fr_item_bq = q_content.get('first_request', [{}])[0]
            bq_page = self._get_safe_from_dict(fr_item_bq, 'QuestionPage')
            bq_sort_str = self._get_safe_from_dict(fr_item_bq, 'QuestionID')

            existing_bq_id = None
            if not is_new_book:
                self.cursor.execute("SELECT EntryID FROM BookQuestions WHERE BookID = %s AND QuestionID = %s LIMIT 1",
                                    (target_meaningful_book_id, global_qid))
                row = self.cursor.fetchone()
                if row: existing_bq_id = row['EntryID']

            if existing_bq_id:
                update_fields_bq = {};
                if bq_page is not None: update_fields_bq['QuestionPage'] = bq_page
                if bq_sort_str is not None: update_fields_bq['QuestionSort'] = bq_sort_str
                if update_fields_bq:
                    set_clause = ", ".join([f"`{k}` = %({k})s" for k in update_fields_bq])
                    sql_upd_bq = f"UPDATE BookQuestions SET {set_clause} WHERE EntryID = %(EntryID)s"
                    update_fields_bq['EntryID'] = existing_bq_id
                    try:
                        self.cursor.execute(sql_upd_bq, update_fields_bq); stats['bq_link'][
                            'updated' if self.cursor.rowcount > 0 else 'skipped_no_change'] += 1
                    except mysql.connector.Error as err:
                        stats['bq_link']['f'] += 1; self.signal_log.emit(f"  更新BQ {existing_bq_id}出错: {err.msg}")
                else:
                    stats['bq_link']['skipped_no_change'] += 1
            elif is_new_book:  # Only create BQ link if it's a new book being populated from quest.json
                sql_ins_bq = """INSERT INTO BookQuestions (EntryID, BookID, QuestionID, QuestionPage, QuestionSort, Sort) 
                                 VALUES (%(EntryID)s, %(BookID)s, %(QuestionID)s, %(QuestionPage)s, %(QuestionSort)s, %(Sort)s)
                                 ON DUPLICATE KEY UPDATE QuestionPage=VALUES(QuestionPage), QuestionSort=VALUES(QuestionSort), Sort=VALUES(Sort)"""
                val_bq_ins = {'EntryID': -global_qid, 'BookID': target_meaningful_book_id, 'QuestionID': global_qid,
                              'QuestionPage': bq_page, 'QuestionSort': bq_sort_str, 'Sort': question_order}
                try:
                    self.cursor.execute(sql_ins_bq, val_bq_ins); stats['bq_link']['s'] += 1
                except mysql.connector.Error as err:
                    stats['bq_link']['f'] += 1; self.signal_log.emit(f"  为新书插入BQ (QID {global_qid})出错: {err.msg}")
            else:  # Existing book, but no link found from book.json. Log, but don't create from quest.json unless explicit.
                self.signal_log.emit(
                    f"  警告: BookID {target_meaningful_book_id} 与 QID {global_qid} 的BookQuestions链接未在book.json中找到。详情可能孤立。")

            if q_content.get('second_request'):
                for sr_item in q_content['second_request']:
                    linked_kp_db_id = None
                    if sr_item.get('_question_code') and sr_item['_question_code'].get('Code'):
                        kp_code = sr_item['_question_code']['Code']
                        qc_data = sr_item['_question_code']
                        val_kp = {'KPCode': kp_code,
                                  'KPTitle': self._get_safe_from_dict(qc_data, 'Title', f"KP {kp_code}"),
                                  'KPContent': self._get_safe_from_dict(qc_data, 'Content'),
                                  'KPType': self._get_safe_from_dict(qc_data, 'Type'),
                                  'KPBusType': self._get_safe_from_dict(qc_data, 'BusType'),
                                  'KPPCode': self._get_safe_from_dict(qc_data, 'PCode'),
                                  'KPNotes': self._get_safe_from_dict(qc_data, 'Notes'),
                                  'KPOutlineType': self._get_safe_from_dict(qc_data, 'OutlineType'),
                                  'KPDifficultyType': self._get_safe_from_dict(qc_data, 'DifficultyType')}
                        sql_kp = "INSERT INTO KnowledgePoints (KPCode, KPTitle, KPContent, KPType, KPBusType, KPPCode, KPNotes, KPOutlineType, KPDifficultyType) VALUES (%(KPCode)s, %(KPTitle)s, %(KPContent)s, %(KPType)s, %(KPBusType)s, %(KPPCode)s, %(KPNotes)s, %(KPOutlineType)s, %(KPDifficultyType)s) ON DUPLICATE KEY UPDATE KPTitle=VALUES(KPTitle), KPContent=VALUES(KPContent), KPType=VALUES(KPType), KPBusType=VALUES(KPBusType), KPPCode=VALUES(KPPCode), KPNotes=VALUES(KPNotes), KPOutlineType=VALUES(KPOutlineType), KPDifficultyType=VALUES(KPDifficultyType);"
                        try:
                            self.cursor.execute(sql_kp, val_kp); stats['kp']['s'] += 1
                        except mysql.connector.Error as err:
                            stats['kp']['f'] += 1; self.signal_log.emit(f"  处理KP {kp_code}出错: {err.msg}")
                        if stats['kp']['s'] > 0:  # Assume success if no error, then fetch ID
                            self.cursor.execute("SELECT KnowledgePointID FROM KnowledgePoints WHERE KPCode = %s",
                                                (kp_code,))
                            kp_res = self.cursor.fetchone();
                            if kp_res: linked_kp_db_id = kp_res['KnowledgePointID']

                    src_detail_id = self._get_safe_from_dict(sr_item, 'ID');
                    bus_type = self._get_safe_from_dict(sr_item, 'BusType', 'N/A')
                    if src_detail_id is None: stats['qd']['f'] += 1; self.signal_log.emit(
                        "  跳过QD: SourceDetailID缺失。"); continue
                    json_data_val = self._get_safe_from_dict(sr_item, 'Json');
                    json_str = json.dumps(json_data_val, ensure_ascii=False) if json_data_val is not None else None
                    val_qd = {'QuestionID': global_qid, 'BusType': bus_type, 'SourceDetailID': src_detail_id,
                              'Context': self._get_safe_from_dict(sr_item, 'Context'),
                              'Give': self._get_safe_from_dict(sr_item, 'Give'),
                              'Notes': self._get_safe_from_dict(sr_item, 'Notes'), 'JsonData': json_str,
                              'Title': self._get_safe_from_dict(sr_item, 'Title'),
                              'IsProductBook': bool(self._get_safe_from_dict(sr_item, 'IsProductBook', 0)),
                              'LinkedKnowledgePointID': linked_kp_db_id}
                    sql_qd = "INSERT INTO QuestionDetails (QuestionID, BusType, SourceDetailID, Context, Give, Notes, JsonData, Title, IsProductBook, LinkedKnowledgePointID) VALUES (%(QuestionID)s, %(BusType)s, %(SourceDetailID)s, %(Context)s, %(Give)s, %(Notes)s, %(JsonData)s, %(Title)s, %(IsProductBook)s, %(LinkedKnowledgePointID)s) ON DUPLICATE KEY UPDATE Context=VALUES(Context), Give=VALUES(Give), Notes=VALUES(Notes), JsonData=VALUES(JsonData), Title=VALUES(Title), IsProductBook=VALUES(IsProductBook), LinkedKnowledgePointID=VALUES(LinkedKnowledgePointID);"
                    try:
                        self.cursor.execute(sql_qd, val_qd); stats['qd']['s'] += 1
                    except mysql.connector.Error as err:
                        stats['qd']['f'] += 1; self.signal_log.emit(
                            f"  处理QD (SourceDetailID {src_detail_id})出错: {err.msg}")

            if q_content.get('third_request'):
                sql_rq = "INSERT INTO RelatedQuestions (SourceQuestionID, RelatedQuestionOriginalID, SourceThirdRequestID, RelatedQuestionText, LinkNames, FocalLink, QuestionPage) VALUES (%(SourceQuestionID)s, %(RelatedQuestionOriginalID)s, %(SourceThirdRequestID)s, %(RelatedQuestionText)s, %(LinkNames)s, %(FocalLink)s, %(QuestionPage)s) ON DUPLICATE KEY UPDATE SourceThirdRequestID=VALUES(SourceThirdRequestID), RelatedQuestionText=VALUES(RelatedQuestionText), LinkNames=VALUES(LinkNames), FocalLink=VALUES(FocalLink), QuestionPage=VALUES(QuestionPage);"
                for tr_item in q_content['third_request']:
                    rel_q_orig_id = self._get_safe_from_dict(tr_item, 'QuestionID')
                    if rel_q_orig_id is None: stats['rq']['f'] += 1; self.signal_log.emit(
                        "  跳过RQ: RelatedQuestionOriginalID缺失。"); continue
                    val_rq = {'SourceQuestionID': global_qid, 'RelatedQuestionOriginalID': rel_q_orig_id,
                              'SourceThirdRequestID': self._get_safe_from_dict(tr_item, 'ID'),
                              'RelatedQuestionText': self._get_safe_from_dict(tr_item, 'QuestionTxt'),
                              'LinkNames': self._get_safe_from_dict(tr_item, 'LinkNames'),
                              'FocalLink': self._get_safe_from_dict(tr_item, 'FocalLink'),
                              'QuestionPage': self._get_safe_from_dict(tr_item, 'QuestionPage')}
                    try:
                        self.cursor.execute(sql_rq, val_rq); stats['rq']['s'] += 1
                    except mysql.connector.Error as err:
                        stats['rq']['f'] += 1; self.signal_log.emit(f"  处理RQ (RelatedQID {rel_q_orig_id})出错: {err.msg}")
            self.cnx.commit();
            self.signal_log.emit(f"  已提交全局QID {global_qid} 的详细信息。")
        self.cursor.execute("SET SESSION foreign_key_checks = 1;")
        return stats

    def fetch_books_task(self):
        self.signal_log.emit("正在从数据库获取书籍列表...")
        try:
            self.cursor.execute(
                "SELECT b.ID as InternalBookPK, b.BookID as MeaningfulBookID, b.BookTitle, s.SubjectName FROM Books b JOIN Subjects s ON b.SubjectID = s.SubjectID ORDER BY s.SubjectName, b.BookTitle")
            books = self.cursor.fetchall()
            self.signal_populate_book_combo.emit(books or [])
            self.signal_finished.emit("成功获取书籍列表。" if books else "数据库中未找到书籍。")
        except mysql.connector.Error as err:
            self.signal_log.emit(f"获取书籍列表出错: {err}")
            self.signal_finished.emit(f"获取书籍列表出错: {err.msg}")
        except Exception as e:
            self.signal_log.emit(f"获取书籍列表时发生未知错误: {e}")
            self.signal_finished.emit("获取书籍列表时发生未知错误。")


# --- 主GUI应用 ---
class DBImporterApp(QWidget):
    def __init__(self):
        super().__init__()
        self.book_json_path = None
        self.quest_json_path = None
        self.existing_books_data = []
        self.initUI()
        self.worker = None
        self.progress_dialog = None

    def initUI(self):
        self.setWindowTitle('OJLD 数据导入工具')  # 中文标题
        self.setGeometry(100, 100, 750, 850)  # 调整窗口大小

        main_layout = QVBoxLayout(self)
        tabs = QTabWidget()
        tabs.setFont(QFont("微软雅黑", 10))  # 设置Tab字体

        # --- Tab 1: 数据库结构管理 ---
        schema_tab = QWidget()
        schema_layout = QVBoxLayout(schema_tab)
        schema_layout.setAlignment(Qt.AlignTop)
        schema_layout.setSpacing(15)  # 增加间距

        reset_schema_button = QPushButton('⚠️ 重置并重建数据库结构 (危险操作!)')
        reset_schema_button.setStyleSheet(
            "background-color: #FFEBEE; color: #D32F2F; font-weight: bold; padding: 12px; border-radius: 5px; font-size: 11pt;")
        reset_schema_button.clicked.connect(self.confirm_reset_schema)

        schema_info_label = QLabel("此操作将<b>删除所有现有数据表</b>并重新创建数据库结构。<br>请<b>极度谨慎</b>使用！建议操作前备份数据库。")
        schema_info_label.setWordWrap(True)

        schema_layout.addWidget(reset_schema_button)
        schema_layout.addWidget(schema_info_label)
        tabs.addTab(schema_tab, "数据库结构管理")

        # --- Tab 2: 导入 book.json ---
        book_json_tab = QWidget()
        book_json_layout = QVBoxLayout(book_json_tab)
        book_json_layout.setAlignment(Qt.AlignTop)
        book_json_layout.setSpacing(10)

        select_book_json_button = QPushButton("选择 `book.json` 文件")
        select_book_json_button.setStyleSheet("padding: 8px;")
        select_book_json_button.clicked.connect(self.select_book_json_file)
        self.book_json_label = QLabel("尚未选择 `book.json` 文件。")
        self.book_json_label.setStyleSheet("color: #555;")

        upload_book_json_button = QPushButton("上传书籍结构数据 (`book.json`)")
        upload_book_json_button.setStyleSheet(
            "background-color: #E8F5E9; color: #2E7D32; font-weight: bold; padding: 10px; border-radius: 5px; font-size: 10pt;")
        upload_book_json_button.clicked.connect(self.upload_book_json_data)

        book_json_layout.addWidget(select_book_json_button)
        book_json_layout.addWidget(self.book_json_label)
        book_json_layout.addSpacing(20)
        book_json_layout.addWidget(upload_book_json_button)
        tabs.addTab(book_json_tab, "导入书籍结构 (book.json)")

        # --- Tab 3: 导入 quest.json ---
        quest_json_tab = QWidget()
        quest_json_layout = QVBoxLayout(quest_json_tab)
        quest_json_layout.setAlignment(Qt.AlignTop)
        quest_json_layout.setSpacing(10)

        select_quest_json_button = QPushButton("选择 `quest.json` 文件")
        select_quest_json_button.setStyleSheet("padding: 8px;")
        select_quest_json_button.clicked.connect(self.select_quest_json_file)
        self.quest_json_label = QLabel("尚未选择 `quest.json` 文件。")
        self.quest_json_label.setStyleSheet("color: #555;")

        book_selection_group = QGroupBox("选择目标书籍 (用于关联问题详情)")
        book_selection_group.setFont(QFont("微软雅黑", 10, QFont.Bold))
        book_selection_form_layout = QFormLayout(book_selection_group)
        book_selection_form_layout.setSpacing(10)

        self.refresh_books_button = QPushButton("🔄 刷新书籍列表")
        self.refresh_books_button.setStyleSheet("padding: 6px;")
        self.refresh_books_button.clicked.connect(self.fetch_and_populate_books_combo)
        self.book_combo = QComboBox()
        self.book_combo.addItem("--- 请选择已有书籍 ---", None)
        self.book_combo.addItem("+++ 创建新书籍 +++", "CREATE_NEW")
        self.book_combo.currentIndexChanged.connect(self.handle_book_selection_change)

        book_selection_form_layout.addRow(self.refresh_books_button)
        book_selection_form_layout.addRow(QLabel("关联问题到:"), self.book_combo)

        self.new_book_group = QGroupBox("新书籍详情 (若选择'创建新书籍')")
        self.new_book_group.setFont(QFont("微软雅黑", 10, QFont.Bold))
        new_book_form = QFormLayout(self.new_book_group)
        new_book_form.setSpacing(10)
        self.new_book_title_edit = QLineEdit()
        self.new_book_meaningful_id_edit = QLineEdit()
        self.new_book_subject_combo = QComboBox()
        new_book_form.addRow("新书籍标题:", self.new_book_title_edit)
        new_book_form.addRow("新书籍业务ID (唯一整数):", self.new_book_meaningful_id_edit)
        new_book_form.addRow("新书籍所属科目:", self.new_book_subject_combo)
        self.new_book_group.setVisible(False)

        upload_quest_json_button = QPushButton("上传问题详情数据 (`quest.json`)")
        upload_quest_json_button.setStyleSheet(
            "background-color: #E3F2FD; color: #1565C0; font-weight: bold; padding: 10px; border-radius: 5px; font-size: 10pt;")
        upload_quest_json_button.clicked.connect(self.upload_quest_json_data)

        quest_json_layout.addWidget(select_quest_json_button)
        quest_json_layout.addWidget(self.quest_json_label)
        quest_json_layout.addWidget(book_selection_group)
        quest_json_layout.addWidget(self.new_book_group)
        quest_json_layout.addSpacing(20)
        quest_json_layout.addWidget(upload_quest_json_button)
        tabs.addTab(quest_json_tab, "导入问题详情 (quest.json)")

        # --- 日志区域 ---
        log_label = QLabel("操作日志:")
        log_label.setFont(QFont("微软雅黑", 10, QFont.Bold))
        self.log_area = QTextEdit()
        self.log_area.setReadOnly(True)
        self.log_area.setFont(QFont("Consolas", 9))  # 使用Consolas或类似的等宽字体
        self.log_area.setLineWrapMode(QTextEdit.WidgetWidth)  # 自动换行
        self.log_area.setStyleSheet("background-color: #f5f5f5; border: 1px solid #ccc; padding: 5px;")

        main_layout.addWidget(tabs)
        main_layout.addWidget(log_label)
        main_layout.addWidget(self.log_area, 1)

        self.setLayout(main_layout)
        self.log_message("应用程序已启动。如果需要，请在脚本中配置数据库密码。")
        self.fetch_and_populate_books_combo()
        self.populate_subjects_combo()

    def log_message(self, message):
        self.log_area.append(message)
        self.log_area.verticalScrollBar().setValue(self.log_area.verticalScrollBar().maximum())

    def show_progress_dialog(self, title, max_val=0):  # 设置中文标题
        self.progress_dialog = QProgressDialog(title, "取消", 0, max_val, self)
        self.progress_dialog.setWindowTitle("处理中")  # 对话框标题
        self.progress_dialog.setWindowModality(Qt.WindowModal)
        self.progress_dialog.setAutoClose(True)
        self.progress_dialog.setAutoReset(True)
        self.progress_dialog.setValue(0)
        self.progress_dialog.canceled.connect(self.cancel_worker)
        self.progress_dialog.show()

    def update_progress_max(self, max_val):
        if self.progress_dialog: self.progress_dialog.setMaximum(max_val)

    def update_progress_value(self, value):
        if self.progress_dialog:
            self.progress_dialog.setValue(value)
            # if value >= self.progress_dialog.maximum(): self.progress_dialog.reset() # AutoReset handles this

    def cancel_worker(self):
        if self.worker and self.worker.isRunning():
            self.log_message("请求取消任务...")  # 中文
            self.worker.requestInterruption()

    def task_finished(self, message):
        self.log_message(f"任务完成: {message}")  # 中文
        if self.progress_dialog: self.progress_dialog.reset()
        QMessageBox.information(self, "任务完成", message)  # 中文标题和内容
        if hasattr(self.worker, 'task_type') and (
                self.worker.task_type == "import_quest_json" or self.worker.task_type == "reset_schema"):
            self.fetch_and_populate_books_combo()

    def confirm_reset_schema(self):
        reply = QMessageBox.warning(self, '确认重置数据库结构',  # 中文标题
                                    "您确定要删除所有数据表并重新创建数据库结构吗？\n"
                                    "此操作<b>不可逆</b>，将删除所有数据！请谨慎操作！",  # 中文内容
                                    QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            self.log_message("用户已确认重置数据库结构。")  # 中文
            self.worker = WorkerThread(task_type="reset_schema")
            self.worker.signal_log.connect(self.log_message)
            self.worker.signal_finished.connect(self.task_finished)
            self.worker.start()
            self.show_progress_dialog("正在重置数据库结构...")  # 中文
        else:
            self.log_message("用户取消了数据库结构重置操作。")  # 中文

    def select_book_json_file(self):
        filePath, _ = QFileDialog.getOpenFileName(self, "选择 `book.json` 文件", "", "JSON 文件 (*.json)")  # 中文
        if filePath:
            self.book_json_path = filePath
            self.book_json_label.setText(f"已选择: {os.path.basename(filePath)}")  # 中文
            self.log_message(f"`book.json` 已选择: {filePath}")  # 中文

    def upload_book_json_data(self):
        if not self.book_json_path:
            QMessageBox.warning(self, "未选择文件", "请先选择一个 `book.json` 文件。")  # 中文
            return
        self.log_message(f"开始上传 `book.json`: {self.book_json_path}")  # 中文
        self.worker = WorkerThread(task_type="import_book_json", json_file_path=self.book_json_path)
        # ... (信号连接保持不变)
        self.worker.signal_log.connect(self.log_message)
        self.worker.signal_finished.connect(self.task_finished)
        self.worker.signal_progress_max.connect(self.update_progress_max)
        self.worker.signal_progress_value.connect(self.update_progress_value)
        self.worker.start()
        self.show_progress_dialog(f"正在导入 {os.path.basename(self.book_json_path)}...")  # 中文

    def select_quest_json_file(self):
        filePath, _ = QFileDialog.getOpenFileName(self, "选择 `quest.json` 文件", "", "JSON 文件 (*.json)")  # 中文
        if filePath:
            self.quest_json_path = filePath
            self.quest_json_label.setText(f"已选择: {os.path.basename(filePath)}")  # 中文
            self.log_message(f"`quest.json` 已选择: {filePath}")  # 中文

    def fetch_and_populate_books_combo(self):
        self.log_message("正在获取书籍列表以填充下拉框...")  # 中文
        self.worker = WorkerThread(task_type="fetch_books")
        # ... (信号连接保持不变)
        self.worker.signal_log.connect(self.log_message)
        self.worker.signal_finished.connect(self.task_finished)
        self.worker.signal_populate_book_combo.connect(self.populate_book_combo_actual)
        self.worker.start()

    def populate_book_combo_actual(self, books_list_from_db):
        self.book_combo.clear()
        self.book_combo.addItem("--- 请选择已有书籍 ---", None)  # 中文
        self.book_combo.addItem("+++ 创建新书籍 +++", "CREATE_NEW")  # 中文
        self.existing_books_data = []
        if books_list_from_db:
            for book_row in books_list_from_db:
                display_text = f"{book_row['BookTitle']} (科目: {book_row['SubjectName']}, 业务ID: {book_row['MeaningfulBookID']})"  # 中文
                self.book_combo.addItem(display_text, book_row['MeaningfulBookID'])
                self.existing_books_data.append({
                    'text': display_text, 'meaningful_id': book_row['MeaningfulBookID'],
                    'internal_pk': book_row['InternalBookPK']})
        self.log_message(f"书籍下拉框已填充 {len(books_list_from_db)} 本书籍。")  # 中文

    def populate_subjects_combo(self):
        self.new_book_subject_combo.clear()
        cnx = None;
        cursor = None
        try:
            cnx = mysql.connector.connect(**DB_CONFIG)
            cursor = cnx.cursor(dictionary=True)
            cursor.execute("SELECT SubjectID, SubjectName FROM Subjects ORDER BY SubjectName")
            subjects = cursor.fetchall()
            if subjects:
                for subject in subjects:
                    self.new_book_subject_combo.addItem(subject['SubjectName'], subject['SubjectID'])
            else:
                self.new_book_subject_combo.addItem("未找到科目", None)  # 中文
        except mysql.connector.Error as err:
            self.log_message(f"获取新书科目列表出错: {err}")  # 中文
            self.new_book_subject_combo.addItem("加载科目出错", None)  # 中文
        finally:
            if cursor: cursor.close()
            if cnx and cnx.is_connected(): cnx.close()

    def handle_book_selection_change(self, index):
        selected_data = self.book_combo.itemData(index)
        if selected_data == "CREATE_NEW":
            self.new_book_group.setVisible(True)
        else:
            self.new_book_group.setVisible(False)

    def upload_quest_json_data(self):
        if not self.quest_json_path:
            QMessageBox.warning(self, "未选择文件", "请先选择一个 `quest.json` 文件。")  # 中文
            return
        selected_book_combo_data = self.book_combo.currentData()
        target_book_meaningful_id = None;
        is_new_book = False;
        book_title_for_log = ""
        new_book_internal_pk = None
        if selected_book_combo_data == "CREATE_NEW":
            is_new_book = True
            book_title_for_log = self.new_book_title_edit.text().strip()
            meaningful_id_str = self.new_book_meaningful_id_edit.text().strip()
            selected_subject_id_for_new_book = self.new_book_subject_combo.currentData()
            if not book_title_for_log: QMessageBox.warning(self, "输入错误", "新书籍标题不能为空。"); return  # 中文
            if not meaningful_id_str: QMessageBox.warning(self, "输入错误", "新书籍业务ID不能为空。"); return  # 中文
            try:
                target_book_meaningful_id = int(meaningful_id_str)
            except ValueError:
                QMessageBox.warning(self, "输入错误", "新书籍业务ID必须是整数。"); return  # 中文
            if selected_subject_id_for_new_book is None: QMessageBox.warning(self, "输入错误", "请为新书籍选择科目。"); return  # 中文

            cnx_check = None;
            cursor_check = None
            try:  # ... (创建新书的逻辑保持不变)
                cnx_check = mysql.connector.connect(**DB_CONFIG)
                cursor_check = cnx_check.cursor()
                cursor_check.execute("SELECT ID FROM Books WHERE BookID = %s", (target_book_meaningful_id,))
                if cursor_check.fetchone(): QMessageBox.warning(self, "输入错误",
                                                                f"业务ID为 {target_book_meaningful_id} 的书籍已存在。"); return
                sql_ib = "INSERT INTO Books (BookID, BookTitle, SubjectID, SourceJsonFileName) VALUES (%s, %s, %s, %s)"
                cursor_check.execute(sql_ib, (
                target_book_meaningful_id, book_title_for_log, selected_subject_id_for_new_book,
                os.path.basename(self.quest_json_path)))
                new_book_internal_pk = cursor_check.lastrowid;
                cnx_check.commit()
                self.log_message(
                    f"新书籍 '{book_title_for_log}' 已创建 (业务ID: {target_book_meaningful_id}, 内部主键: {new_book_internal_pk})。")
            except mysql.connector.Error as err:
                QMessageBox.critical(self, "数据库错误", f"创建新书籍时出错: {err}"); return
            finally:  # ... (关闭连接)
                if cursor_check: cursor_check.close()
                if cnx_check and cnx_check.is_connected(): cnx_check.close()
            if new_book_internal_pk is None: QMessageBox.critical(self, "错误", "未能获取新书籍的内部主键。"); return

        elif selected_book_combo_data is not None:  # ... (选择已有书籍的逻辑保持不变)
            target_book_meaningful_id = selected_book_combo_data
            selected_book_internal_pk_for_update = None
            for book_entry in self.existing_books_data:
                if book_entry['meaningful_id'] == target_book_meaningful_id:
                    selected_book_internal_pk_for_update = book_entry['internal_pk']
                    book_title_for_log = self.book_combo.currentText().split(' (科目:')[0]
                    break
            if selected_book_internal_pk_for_update is None: QMessageBox.critical(self, "错误",
                                                                                  "无法找到所选已有书籍的内部主键。"); return
            cnx_update = None;
            cursor_update = None
            try:
                cnx_update = mysql.connector.connect(**DB_CONFIG)
                cursor_update = cnx_update.cursor()
                cursor_update.execute("UPDATE Books SET SourceJsonFileName = %s WHERE ID = %s",
                                      (os.path.basename(self.quest_json_path), selected_book_internal_pk_for_update))
                cnx_update.commit()
                self.log_message(
                    f"已更新书籍 '{book_title_for_log}' 的SourceJsonFileName为 '{os.path.basename(self.quest_json_path)}'。")
            except mysql.connector.Error as err:
                QMessageBox.warning(self, "数据库错误", f"无法更新书籍的SourceJsonFileName: {err}")
            finally:  # ... (关闭连接)
                if cursor_update: cursor_update.close()
                if cnx_update and cnx_update.is_connected(): cnx_update.close()
        else:
            QMessageBox.warning(self, "未选择书籍", "请选择一个已有书籍或选择创建新书籍。"); return  # 中文

        if target_book_meaningful_id is None: QMessageBox.critical(self, "错误", "无法确定目标书籍ID。"); return  # 中文
        self.log_message(
            f"开始上传 `quest.json`: {self.quest_json_path}，目标书籍: '{book_title_for_log}' (业务ID: {target_book_meaningful_id})")  # 中文
        self.worker = WorkerThread(task_type="import_quest_json", json_file_path=self.quest_json_path,
                                   target_book_meaningful_id=target_book_meaningful_id, is_new_book=is_new_book,
                                   book_title_for_log=book_title_for_log)
        # ... (信号连接保持不变)
        self.worker.signal_log.connect(self.log_message)
        self.worker.signal_finished.connect(self.task_finished)
        self.worker.signal_progress_max.connect(self.update_progress_max)
        self.worker.signal_progress_value.connect(self.update_progress_value)
        self.worker.start()
        self.show_progress_dialog(f"正在为 '{book_title_for_log}' 导入 {os.path.basename(self.quest_json_path)}...")  # 中文


if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = DBImporterApp()
    ex.show()
    sys.exit(app.exec_())